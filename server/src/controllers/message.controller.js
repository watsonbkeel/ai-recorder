const messageService = require('../services/message.service')
const { sendSuccess } = require('../utils/response')

async function listMessages(req, res) {
  const data = await messageService.listMessages(req.user.id, req.params.familyId, req.query)
  return sendSuccess(res, data, 'ok')
}

async function createMessage(req, res) {
  const data = await messageService.createMessage(req.user.id, req.params.familyId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function getMessage(req, res) {
  const data = await messageService.getMessageDetail(req.user.id, req.params.messageId)
  return sendSuccess(res, data, 'ok')
}

async function getOriginalAudio(req, res) {
  const data = await messageService.getOriginalAudioFile(req.user.id, req.params.messageId)
  return res.download(data.filePath, data.fileName)
}

async function deleteMessage(req, res) {
  const data = await messageService.deleteMessage(req.user.id, req.params.messageId)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  listMessages,
  createMessage,
  getMessage,
  getOriginalAudio,
  deleteMessage
}
