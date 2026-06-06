const { getApiBaseUrl } = require('./config')
const auth = require('./auth')

function showError(message) {
  wx.showToast({ title: message || '请求失败', icon: 'none' })
}

function buildRequestError(message, code, statusCode) {
  const error = new Error(message || '请求失败')
  error.code = code || 'REQUEST_FAILED'
  error.statusCode = statusCode || 0
  return error
}

function request(options) {
  const token = auth.getToken()
  const apiBaseUrl = getApiBaseUrl()
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(options.header || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(res) {
        const data = res.data || {}
        if (res.statusCode === 401 || (data.error && data.error.code === 'UNAUTHORIZED')) {
          auth.clearSession()
          auth.redirectToLogin()
          reject(buildRequestError('UNAUTHORIZED', 'UNAUTHORIZED', res.statusCode))
          return
        }

        if (!data.success) {
          const message = data.error ? data.error.message : '请求失败'
          const code = data.error ? data.error.code : 'REQUEST_FAILED'
          if (!options.silent) {
            showError(message)
          }
          reject(buildRequestError(message, code, res.statusCode))
          return
        }

        resolve(data.data)
      },
      fail(error) {
        if (!options.silent) {
          showError('网络异常，请稍后再试')
        }
        reject(buildRequestError(error.errMsg || '网络异常，请稍后再试', 'NETWORK_ERROR', 0))
      }
    })
  })
}

module.exports = request
