const request = require('../utils/request')
const auth = require('../utils/auth')
const { getApiRootUrl } = require('../utils/config')
const { buildRequestError } = request

function fullUrl(url) {
  if (!url) {
    return ''
  }
  if (/^https?:\/\//.test(url)) {
    return url
  }
  return `${getApiRootUrl()}${url}`
}

function getMessages(familyId, params) {
  return request({ url: `/families/${familyId}/messages`, data: params || {} })
}

function createMessage(familyId, data) {
  return request({ url: `/families/${familyId}/messages`, method: 'POST', data })
}

function getMessageDetail(messageId) {
  return request({ url: `/messages/${messageId}` })
}

function deleteMessage(messageId) {
  return request({ url: `/messages/${messageId}`, method: 'DELETE' })
}

function readDownloadErrorBody(tempFilePath) {
  if (!tempFilePath || !wx.getFileSystemManager) {
    return null
  }

  try {
    const content = wx.getFileSystemManager().readFileSync(tempFilePath, 'utf8')
    return JSON.parse(content || '{}')
  } catch (error) {
    return null
  }
}

function buildDownloadError(res) {
  const data = readDownloadErrorBody(res.tempFilePath)
  const code = data && data.error ? data.error.code : 'DOWNLOAD_FAILED'
  const message = data && data.error
    ? data.error.message
    : `原始语音下载失败（${res.statusCode || 0}）`

  return buildRequestError(message, code, res.statusCode || 0)
}

function downloadOriginalAudio(originalAudioUrl) {
  const url = fullUrl(originalAudioUrl)
  const token = auth.getToken()
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
          resolve(res.tempFilePath)
          return
        }

        const downloadError = buildDownloadError(res)
        if (downloadError.statusCode === 401 || downloadError.code === 'UNAUTHORIZED') {
          auth.clearSession()
          auth.redirectToLogin()
          reject(buildRequestError('UNAUTHORIZED', 'UNAUTHORIZED', res.statusCode))
          return
        }
        reject(downloadError)
      },
      fail(error) {
        reject(buildRequestError(error.errMsg || '原始语音下载失败，请检查网络后重试', 'NETWORK_ERROR', 0))
      }
    })
  })
}

module.exports = {
  getMessages,
  createMessage,
  getMessageDetail,
  deleteMessage,
  downloadOriginalAudio
}
