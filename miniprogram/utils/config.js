const defaultConfig = {
  PUBLIC_BASE_URL: 'https://recorder.bkeel.com',
  API_BASE_URL: 'https://recorder.bkeel.com/api'
}
const LOCAL_CONFIG_KEY = 'AI_RECORDER_LOCAL_CONFIG'

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/$/, '')
}

function loadLocalConfigFromStorage() {
  try {
    if (typeof wx === 'undefined' || !wx.getStorageSync) {
      return {}
    }
    const localConfig = wx.getStorageSync(LOCAL_CONFIG_KEY) || {}
    return {
      ...(localConfig.PUBLIC_BASE_URL ? { PUBLIC_BASE_URL: normalizeUrl(localConfig.PUBLIC_BASE_URL) } : {}),
      ...(localConfig.API_BASE_URL ? { API_BASE_URL: normalizeUrl(localConfig.API_BASE_URL) } : {})
    }
  } catch (error) {
    return {}
  }
}

function getRuntimeConfig() {
  return Object.assign({}, defaultConfig, loadLocalConfigFromStorage())
}

function getPublicBaseUrl() {
  return getRuntimeConfig().PUBLIC_BASE_URL
}

function getApiBaseUrl() {
  return getRuntimeConfig().API_BASE_URL
}

function getApiRootUrl() {
  return getApiBaseUrl().replace(/\/api$/, '')
}

module.exports = {
  PUBLIC_BASE_URL: defaultConfig.PUBLIC_BASE_URL,
  API_BASE_URL: defaultConfig.API_BASE_URL,
  LOCAL_CONFIG_KEY,
  getRuntimeConfig,
  getPublicBaseUrl,
  getApiBaseUrl,
  getApiRootUrl
}
