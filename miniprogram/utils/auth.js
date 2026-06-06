const STORAGE_PREFIX = 'AI_RECORDER'
const TOKEN_KEY = `${STORAGE_PREFIX}_TOKEN`
const USER_KEY = `${STORAGE_PREFIX}_USER`
const CURRENT_FAMILY_KEY = `${STORAGE_PREFIX}_CURRENT_FAMILY`
const LEGACY_TOKEN_KEY = 'TOKEN'
const LEGACY_USER_KEY = 'USER'
const LEGACY_CURRENT_FAMILY_KEY = 'CURRENT_FAMILY'

function clearLegacyStorage() {
  wx.removeStorageSync(LEGACY_TOKEN_KEY)
  wx.removeStorageSync(LEGACY_USER_KEY)
  wx.removeStorageSync(LEGACY_CURRENT_FAMILY_KEY)
}

function getToken() {
  clearLegacyStorage()
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function getUser() {
  clearLegacyStorage()
  return wx.getStorageSync(USER_KEY) || null
}

function getCurrentFamily() {
  clearLegacyStorage()
  return wx.getStorageSync(CURRENT_FAMILY_KEY) || null
}

function setSession(token, user) {
  wx.setStorageSync(TOKEN_KEY, token)
  wx.setStorageSync(USER_KEY, user)
  wx.removeStorageSync(LEGACY_TOKEN_KEY)
  wx.removeStorageSync(LEGACY_USER_KEY)
}

function setUser(user) {
  wx.setStorageSync(USER_KEY, user)
  wx.removeStorageSync(LEGACY_USER_KEY)
}

function setCurrentFamily(currentFamily) {
  wx.setStorageSync(CURRENT_FAMILY_KEY, currentFamily)
  wx.removeStorageSync(LEGACY_CURRENT_FAMILY_KEY)
}

function clearCurrentFamily() {
  wx.removeStorageSync(CURRENT_FAMILY_KEY)
  wx.removeStorageSync(LEGACY_CURRENT_FAMILY_KEY)
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
  wx.removeStorageSync(CURRENT_FAMILY_KEY)
  wx.removeStorageSync(LEGACY_TOKEN_KEY)
  wx.removeStorageSync(LEGACY_USER_KEY)
  wx.removeStorageSync(LEGACY_CURRENT_FAMILY_KEY)
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
  clearCurrentFamily,
  clearSession,
  redirectToLogin
}
