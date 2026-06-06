const request = require('../utils/request')

function getComments(diaryId) {
  return request({ url: `/diaries/${diaryId}/comments` })
}

function createComment(diaryId, data) {
  return request({ url: `/diaries/${diaryId}/comments`, method: 'POST', data })
}

function deleteComment(commentId) {
  return request({ url: `/comments/${commentId}`, method: 'DELETE' })
}

function toggleCommentLike(commentId) {
  return request({ url: `/comments/${commentId}/like`, method: 'POST' })
}

module.exports = {
  getComments,
  createComment,
  deleteComment,
  toggleCommentLike
}
