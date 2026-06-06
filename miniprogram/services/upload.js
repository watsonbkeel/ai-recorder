const { API_BASE_URL } = require('../utils/config')
const auth = require('../utils/auth')

function uploadImage(filePath) {
  const token = auth.getToken()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/upload/image`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 120000,
      success(res) {
        let data = null
        try {
          data = JSON.parse(res.data || '{}')
        } catch (error) {
          reject(new Error('上传失败：服务器返回异常'))
          return
        }
        if (res.statusCode === 401 || (data.error && data.error.code === 'UNAUTHORIZED')) {
          auth.clearSession()
          auth.redirectToLogin()
          reject(new Error('UNAUTHORIZED'))
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300 || !data.success) {
          reject(new Error(data.error ? data.error.message : `上传失败（${res.statusCode}）`))
          return
        }
        resolve(data.data)
      },
      fail(error) {
        reject(new Error(error.errMsg || '上传失败，请检查网络后重试'))
      }
    })
  })
}

module.exports = {
  uploadImage
}
