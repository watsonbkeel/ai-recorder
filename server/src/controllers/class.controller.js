const classService = require('../services/class.service')
const { sendSuccess } = require('../utils/response')

async function createClass(req, res) {
  const data = await classService.createClass(req.user.id, req.body)
  return sendSuccess(res, data, 'ok')
}

async function getMyClasses(req, res) {
  const data = await classService.listMyClasses(req.user.id)
  return sendSuccess(res, data, 'ok')
}

async function getAllClasses(req, res) {
  const data = await classService.listAllClasses(req.user.id)
  return sendSuccess(res, data, 'ok')
}

async function updateClassNickname(req, res) {
  const data = await classService.updateClassNickname(req.user.id, req.params.classId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function getClassByInvite(req, res) {
  const data = await classService.getClassByInviteCode(req.params.inviteCode)
  return sendSuccess(res, data, 'ok')
}

async function createJoinRequest(req, res) {
  const data = await classService.createJoinRequest(req.user.id, req.params.classId, req.body)
  return sendSuccess(res, data, '申请已提交，等待管理员审核')
}

module.exports = {
  createClass,
  getMyClasses,
  getAllClasses,
  updateClassNickname,
  getClassByInvite,
  createJoinRequest
}
