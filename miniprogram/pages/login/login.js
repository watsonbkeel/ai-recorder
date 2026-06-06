const authService = require('../../services/auth')
const auth = require('../../utils/auth')

Page({
  data: {
    loading: false,
    error: '',
    mode: 'login',
    accountName: '',
    password: '',
    nickname: '',
    avatarUrl: ''
  },
  async onShow() {
    if (!auth.getToken()) {
      return
    }

    try {
      await authService.getMe()
      wx.reLaunch({ url: '/pages/class-select/class-select' })
    } catch (error) {
      auth.clearSession()
    }
  },
  switchMode() {
    this.setData({ mode: this.data.mode === 'login' ? 'register' : 'login', error: '' })
  },
  async handleSubmit() {
    const accountName = this.data.accountName.trim()
    const password = this.data.password
    if (!accountName || !password) {
      wx.showToast({ title: '请输入账号名和密码', icon: 'none' })
      return
    }

    this.setData({ loading: true, error: '' })
    try {
      const data = this.data.mode === 'register'
        ? await authService.register({
            accountName,
            password,
            nickname: this.data.nickname.trim() || accountName
          })
        : await authService.login({ accountName, password })

      auth.setSession(data.token, data.user)
      getApp().setUser(data.user, data.token)
      wx.showToast({ title: this.data.mode === 'register' ? '注册成功' : '登录成功', icon: 'success' })
      wx.reLaunch({ url: '/pages/class-select/class-select' })
    } catch (error) {
      this.setData({ error: error.message || '操作失败，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },
  handleAccountInput(event) {
    this.setData({ accountName: event.detail.value })
  },
  handlePasswordInput(event) {
    this.setData({ password: event.detail.value })
  },
  handleNicknameInput(event) {
    this.setData({ nickname: event.detail.value })
  },
  handleAvatarInput(event) {
    this.setData({ avatarUrl: event.detail.value })
  }
})
