const { getApiBaseUrl } = require('../utils/config')
const auth = require('../utils/auth')
const { buildRequestError } = require('../utils/request')

function parseUploadResponse(rawData) {
  try {
    return JSON.parse(rawData || '{}')
  } catch (error) {
    throw buildRequestError('上传失败：服务器返回异常', 'INVALID_RESPONSE', 0)
  }
}

function rejectUploadResponse(res, fallbackMessage) {
  const data = parseUploadResponse(res.data)
  const code = data.error ? data.error.code : 'UPLOAD_FAILED'
  const message = data.error ? data.error.message : fallbackMessage

  if (res.statusCode === 401 || code === 'UNAUTHORIZED') {
    auth.clearSession()
    auth.redirectToLogin()
    throw buildRequestError('UNAUTHORIZED', 'UNAUTHORIZED', res.statusCode)
  }

  if (res.statusCode < 200 || res.statusCode >= 300 || !data.success) {
    throw buildRequestError(message, code, res.statusCode)
  }

  return data.data
}

function uploadImage(filePath) {
  const token = auth.getToken()
  const apiBaseUrl = getApiBaseUrl()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${apiBaseUrl}/upload/image`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 120000,
      success(res) {
        try {
          const data = rejectUploadResponse(res, `上传失败（${res.statusCode}）`)
          resolve(data)
        } catch (error) {
          reject(error)
        }
      },
      fail(error) {
        reject(buildRequestError(error.errMsg || '上传失败，请检查网络后重试', 'NETWORK_ERROR', 0))
      }
    })
  })
}

function uploadAudio(filePath) {
  const token = auth.getToken()
  const apiBaseUrl = getApiBaseUrl()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${apiBaseUrl}/upload/audio`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 120000,
      success(res) {
        try {
          const data = rejectUploadResponse(res, `上传失败（${res.statusCode}）`)
          resolve(data)
        } catch (error) {
          reject(error)
        }
      },
      fail(error) {
        reject(buildRequestError(error.errMsg || '上传失败，请检查网络后重试', 'NETWORK_ERROR', 0))
      }
    })
  })
}

module.exports = {
  uploadImage,
  uploadAudio
}
