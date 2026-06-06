const familyService = require('../../services/family')
const auth = require('../../utils/auth')

Page({
  data: {
    loading: true,
    creating: false,
    error: '',
    families: [],
    createName: '',
    createDescription: ''
  },
  onShow() {
    this.loadFamilies()
  },
  async loadFamilies() {
    this.setData({ loading: true, error: '' })
    try {
      const families = await familyService.getMyFamilies()
      this.setData({ families })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  handleNameInput(event) {
    this.setData({ createName: event.detail.value })
  },
  handleDescriptionInput(event) {
    this.setData({ createDescription: event.detail.value })
  },
  selectFamily(event) {
    const currentFamily = event.currentTarget.dataset.item
    auth.setCurrentFamily(currentFamily)
    getApp().setCurrentFamily(currentFamily)
    wx.navigateTo({ url: `/pages/message-list/message-list?familyId=${currentFamily.id}` })
  },
  goJoin() {
    wx.navigateTo({ url: '/pages/join-family/join-family' })
  },
  async createFamily() {
    const name = this.data.createName.trim()
    if (!name) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }
    this.setData({ creating: true, error: '' })
    try {
      const created = await familyService.createFamily({
        name,
        description: this.data.createDescription,
        relationship: 'other'
      })
      auth.setCurrentFamily(created)
      getApp().setCurrentFamily(created)
      wx.showToast({ title: '创建成功', icon: 'success' })
      wx.navigateTo({ url: `/pages/message-list/message-list?familyId=${created.id}` })
    } catch (error) {
      this.setData({ error: error.message || '创建失败' })
    } finally {
      this.setData({ creating: false })
    }
  }
})
