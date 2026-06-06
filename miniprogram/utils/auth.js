const TOKEN_KEY = 'TOKEN'
const USER_KEY = 'USER'
const CURRENT_FAMILY_KEY = 'CURRENT_FAMILY'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function getCurrentFamily() {
  return wx.getStorageSync(CURRENT_FAMILY_KEY) || null
}

function setSession(token, user) {
  wx.setStorageSync(TOKEN_KEY, token)
  wx.setStorageSync(USER_KEY, user)
}

function setUser(user) {
  wx.setStorageSync(USER_KEY, user)
}

function setCurrentFamily(currentFamily) {
  wx.setStorageSync(CURRENT_FAMILY_KEY, currentFamily)
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
  wx.removeStorageSync(CURRENT_FAMILY_KEY)
}

function redirectToLogin() {
  const pages = getCurrentPages()
  const route = pages.length ? pages[pages.length - 1].route : ''
  if (route !== 'pages/login/login') {
    wx.reLaunch({ url: '/pages/login/login' })
  }
}

module.exports = {
  TOKEN_KEY,
  USER_KEY,
  CURRENT_FAMILY_KEY,
  getToken,
  getUser,
  getCurrentFamily,
  setSession,
  setUser,
  setCurrentFamily,
  clearSession,
  redirectToLogin
}
