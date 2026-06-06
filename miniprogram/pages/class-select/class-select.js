const classService = require('../../services/class')
const auth = require('../../utils/auth')

Page({
  data: {
    loading: true,
    error: '',
    activeTab: 'all',
    myClasses: [],
    allClasses: [],
    createName: '',
    createDescription: '',
    user: null
  },
  onShow() {
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '', user: auth.getUser() })
    try {
      const [myClasses, allClasses] = await Promise.all([
        classService.getMyClasses(),
        classService.getAllClasses()
      ])
      this.setData({ myClasses, allClasses: this.sortAllClasses(allClasses) })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  sortAllClasses(classes) {
    const order = { none: 0, rejected: 1, pending: 2, joined: 3, approved: 3 }
    return [...classes].sort((left, right) => {
      const leftOrder = order[left.joinStatus] === undefined ? 0 : order[left.joinStatus]
      const rightOrder = order[right.joinStatus] === undefined ? 0 : order[right.joinStatus]
      return leftOrder - rightOrder
    })
  },
  switchTab(event) {
    this.setData({ activeTab: event.currentTarget.dataset.tab })
  },
  selectClass(event) {
    const currentClass = event.currentTarget.dataset.item
    auth.setCurrentClass(currentClass)
    getApp().setCurrentClass(currentClass)
    wx.navigateTo({ url: `/pages/diary-list/diary-list?classId=${currentClass.id}` })
  },
  goJoin() {
    wx.navigateTo({ url: '/pages/join-class/join-class' })
  },
  async applyJoin(event) {
    const classId = event.currentTarget.dataset.id
    try {
      await classService.createJoinRequest(classId, { message: '申请加入班级' })
      wx.showToast({ title: '申请已提交', icon: 'success' })
      this.loadData()
    } catch (error) {
      wx.showToast({ title: error.message || '申请失败', icon: 'none' })
    }
  },
  handleNameInput(event) {
    this.setData({ createName: event.detail.value })
  },
  handleDescriptionInput(event) {
    this.setData({ createDescription: event.detail.value })
  },
  async createClass() {
    if (!this.data.createName.trim()) {
      wx.showToast({ title: '请输入班级名称', icon: 'none' })
      return
    }

    try {
      const created = await classService.createClass({
        name: this.data.createName,
        description: this.data.createDescription
      })
      const currentClass = { ...created, role: 'admin', isMuted: false }
      auth.setCurrentClass(currentClass)
      getApp().setCurrentClass(currentClass)
      wx.showToast({ title: '创建成功', icon: 'success' })
      wx.navigateTo({ url: `/pages/diary-list/diary-list?classId=${created.id}` })
    } catch (error) {
      this.setData({ error: error.message || '创建失败' })
    }
  }
})
