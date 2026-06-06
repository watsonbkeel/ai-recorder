const request = require('../utils/request')

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

module.exports = {
  getMessages,
  createMessage,
  getMessageDetail,
  deleteMessage
}
