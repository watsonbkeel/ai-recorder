const request = require('../utils/request')

function getReplies(messageId) {
  return request({ url: `/messages/${messageId}/replies` })
}

function createReply(messageId, data) {
  return request({ url: `/messages/${messageId}/replies`, method: 'POST', data })
}

function deleteReply(replyId) {
  return request({ url: `/replies/${replyId}`, method: 'DELETE' })
}

module.exports = {
  getReplies,
  createReply,
  deleteReply
}
