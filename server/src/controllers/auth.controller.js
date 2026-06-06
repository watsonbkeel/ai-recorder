const authService = require('../services/auth.service')
const { sendSuccess } = require('../utils/response')

async function wechatLogin(req, res) {
  const data = await authService.wechatLogin(req.body)
  return sendSuccess(res, data, 'ok')
}

async function register(req, res) {
  const data = await authService.registerWithPassword(req.body)
  return sendSuccess(res, data, 'ok')
}

async function login(req, res) {
  const data = await authService.loginWithPassword(req.body)
  return sendSuccess(res, data, 'ok')
}

async function getMe(req, res) {
  const data = await authService.getCurrentUser(req.user.id)
  return sendSuccess(res, data, 'ok')
}

async function updateMe(req, res) {
  const data = await authService.updateCurrentUser(req.user.id, req.body)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  wechatLogin,
  register,
  login,
  getMe,
  updateMe
}
