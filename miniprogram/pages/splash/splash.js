const auth = require('../../utils/auth')
const authService = require('../../services/auth')

Page({
  onLoad() {
    this.timer = setTimeout(async () => {
      if (auth.getToken()) {
        try {
          await authService.getMe()
          wx.reLaunch({ url: '/pages/family-select/family-select' })
          return
        } catch (error) {
          auth.clearSession()
        }
      }

      wx.reLaunch({ url: '/pages/login/login' })
    }, 2000)
  },
  onUnload() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
})
