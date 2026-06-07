const aiService = require('../services/ai.service')
const { sendSuccess } = require('../utils/response')

async function optimizeMessage(req, res) {
  const data = await aiService.optimizeMessage(req.user.id, req.body)
  return sendSuccess(res, data, 'ok')
}

async function analyzeMessage(req, res) {
  const data = await aiService.analyzeMessage(req.user.id, req.body)
  return sendSuccess(res, data, 'ok')
}

async function optimizeReply(req, res) {
  const data = await aiService.optimizeReply(req.user.id, req.body)
  return sendSuccess(res, data, 'ok')
}

async function transcribeAudio(req, res) {
  const data = await aiService.transcribeAudio(req.user.id, req.body)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  optimizeMessage,
  analyzeMessage,
  optimizeReply,
  transcribeAudio
}
