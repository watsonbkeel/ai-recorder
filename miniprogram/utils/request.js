const { API_BASE_URL } = require('./config')
const auth = require('./auth')

function showError(message) {
  wx.showToast({ title: message || '请求失败', icon: 'none' })
}

function request(options) {
  const token = auth.getToken()
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${options.url}`,
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
          reject(new Error('UNAUTHORIZED'))
          return
        }

        if (!data.success) {
          const message = data.error ? data.error.message : '请求失败'
          if (!options.silent) {
            showError(message)
          }
          reject(new Error(message))
          return
        }

        resolve(data.data)
      },
      fail(error) {
        if (!options.silent) {
          showError('网络异常，请稍后再试')
        }
        reject(error)
      }
    })
  })
}

module.exports = request
