const likeService = require('../services/like.service')
const { sendSuccess } = require('../utils/response')

async function toggleDiaryLike(req, res) {
  const data = await likeService.toggleDiaryLike(req.user.id, req.params.diaryId)
  return sendSuccess(res, data, 'ok')
}

async function toggleCommentLike(req, res) {
  const data = await likeService.toggleCommentLike(req.user.id, req.params.commentId)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  toggleDiaryLike,
  toggleCommentLike
}
