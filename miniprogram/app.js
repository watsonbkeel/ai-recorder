const auth = require('./utils/auth')

App({
  globalData: {
    user: auth.getUser(),
    token: auth.getToken(),
    currentClass: auth.getCurrentClass()
  },
  onLaunch() {
    this.globalData.user = auth.getUser()
    this.globalData.token = auth.getToken()
    this.globalData.currentClass = auth.getCurrentClass()
  },
  setUser(user, token) {
    this.globalData.user = user
    this.globalData.token = token
  },
  setCurrentClass(currentClass) {
    this.globalData.currentClass = currentClass
  }
})
