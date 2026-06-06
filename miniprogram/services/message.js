const request = require('../utils/request')
const auth = require('../utils/auth')
const { getApiRootUrl } = require('../utils/config')

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

function downloadOriginalAudio(originalAudioUrl) {
  const url = fullUrl(originalAudioUrl)
  const token = auth.getToken()
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        if (res.statusCode === 401) {
          auth.clearSession()
          auth.redirectToLogin()
          reject(new Error('UNAUTHORIZED'))
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300 || !res.tempFilePath) {
          reject(new Error(`原始语音下载失败（${res.statusCode || 0}）`))
          return
        }
        resolve(res.tempFilePath)
      },
      fail(error) {
        reject(new Error(error.errMsg || '原始语音下载失败，请检查网络后重试'))
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
