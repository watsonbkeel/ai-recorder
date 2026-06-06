const replyService = require('../services/reply.service')
const { sendSuccess } = require('../utils/response')

async function listReplies(req, res) {
  const data = await replyService.listReplies(req.user.id, req.params.messageId)
  return sendSuccess(res, data, 'ok')
}

async function createReply(req, res) {
  const data = await replyService.createReply(req.user.id, req.params.messageId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function deleteReply(req, res) {
  const data = await replyService.deleteReply(req.user.id, req.params.replyId)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  listReplies,
  createReply,
  deleteReply
}
