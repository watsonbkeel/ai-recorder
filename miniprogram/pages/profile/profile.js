const authService = require('../../services/auth')
const classService = require('../../services/class')
const auth = require('../../utils/auth')

Page({
  data: {
    loading: true,
    error: '',
    user: null,
    classes: [],
    currentClass: null,
    nicknameInput: '',
    avatarUrlInput: '',
    classNicknameInput: '',
    savingProfile: false,
    savingClassNickname: false
  },
  onShow() {
    this.loadData()
  },
  async loadData() {
    this.setData({ loading: true, error: '' })
    try {
      const [user, classes] = await Promise.all([authService.getMe(), classService.getMyClasses()])
      const storedClass = auth.getCurrentClass()
      const currentClass = storedClass
        ? (classes.find((item) => item.id === storedClass.id) || storedClass)
        : null
      if (currentClass) {
        auth.setCurrentClass(currentClass)
        getApp().setCurrentClass(currentClass)
      }
      auth.setUser(user)
      getApp().setUser(user, auth.getToken())
      this.setData({
        user,
        classes,
        currentClass,
        nicknameInput: user.nickname || '',
        avatarUrlInput: user.avatarUrl || '',
        classNicknameInput: currentClass ? (currentClass.classNickname || '') : ''
      })
    } catch (error) {
      this.setData({ error: error.message || '加载失败' })
    } finally {
      this.setData({ loading: false })
    }
  },
  switchClass(event) {
    const currentClass = event.currentTarget.dataset.item
    auth.setCurrentClass(currentClass)
    getApp().setCurrentClass(currentClass)
    this.setData({ currentClass, classNicknameInput: currentClass.classNickname || '' })
    wx.showToast({ title: '已切换班级', icon: 'success' })
  },
  handleNicknameInput(event) {
    this.setData({ nicknameInput: event.detail.value })
  },
  handleAvatarUrlInput(event) {
    this.setData({ avatarUrlInput: event.detail.value })
  },
  handleClassNicknameInput(event) {
    this.setData({ classNicknameInput: event.detail.value })
  },
  async saveProfile() {
    const nickname = this.data.nicknameInput.trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ savingProfile: true, error: '' })
    try {
      const user = await authService.updateMe({
        nickname,
        avatarUrl: this.data.avatarUrlInput.trim()
      })
      auth.setUser(user)
      getApp().setUser(user, auth.getToken())
      this.setData({ user })
      wx.showToast({ title: '昵称已保存', icon: 'success' })
    } catch (error) {
      this.setData({ error: error.message || '保存失败' })
    } finally {
      this.setData({ savingProfile: false })
    }
  },
  async saveClassNickname() {
    if (!this.data.currentClass) {
      wx.showToast({ title: '请先选择班级', icon: 'none' })
      return
    }
    const classNickname = this.data.classNicknameInput.trim()
    if (!classNickname) {
      wx.showToast({ title: '请输入班级昵称', icon: 'none' })
      return
    }

    this.setData({ savingClassNickname: true, error: '' })
    try {
      const updatedClass = await classService.updateClassNickname(this.data.currentClass.id, { classNickname })
      const classes = this.data.classes.map((item) => (item.id === updatedClass.id ? updatedClass : item))
      auth.setCurrentClass(updatedClass)
      getApp().setCurrentClass(updatedClass)
      this.setData({ classes, currentClass: updatedClass })
      wx.showToast({ title: '班级昵称已保存', icon: 'success' })
    } catch (error) {
      this.setData({ error: error.message || '保存失败' })
    } finally {
      this.setData({ savingClassNickname: false })
    }
  },
  logout() {
    auth.clearSession()
    wx.reLaunch({ url: '/pages/login/login' })
  },
  goAdmin() {
    if (this.data.currentClass && this.data.currentClass.role === 'admin') {
      wx.navigateTo({ url: `/pages/admin/dashboard/dashboard?classId=${this.data.currentClass.id}` })
    }
  }
})
