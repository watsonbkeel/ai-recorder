const commentService = require('../services/comment.service')
const { sendSuccess } = require('../utils/response')

async function listComments(req, res) {
  const data = await commentService.listComments(req.user.id, req.params.diaryId)
  return sendSuccess(res, data, 'ok')
}

async function createComment(req, res) {
  const data = await commentService.createComment(req.user.id, req.params.diaryId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function deleteComment(req, res) {
  const data = await commentService.deleteComment(req.user.id, req.params.commentId)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  listComments,
  createComment,
  deleteComment
}
