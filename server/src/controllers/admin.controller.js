const adminService = require('../services/admin.service')
const { sendSuccess } = require('../utils/response')

async function getDashboard(req, res) {
  const data = await adminService.getDashboard(req.user.id, req.params.familyId)
  return sendSuccess(res, data, 'ok')
}

async function listJoinRequests(req, res) {
  const data = await adminService.listJoinRequests(req.user.id, req.params.familyId, req.query)
  return sendSuccess(res, data, 'ok')
}

async function handleJoinRequest(req, res) {
  const data = await adminService.handleJoinRequest(req.user.id, req.params.requestId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function listMembers(req, res) {
  const data = await adminService.listMembers(req.user.id, req.params.familyId)
  return sendSuccess(res, data, 'ok')
}

async function updateMuteStatus(req, res) {
  const data = await adminService.updateMuteStatus(req.user.id, req.params.familyId, req.params.userId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function updateMemberRole(req, res) {
  const data = await adminService.updateMemberRole(req.user.id, req.params.familyId, req.params.userId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function updateMemberIdentity(req, res) {
  const data = await adminService.updateMemberIdentity(req.user.id, req.params.familyId, req.params.userId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function removeMember(req, res) {
  const data = await adminService.removeMember(req.user.id, req.params.familyId, req.params.userId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function hideMessage(req, res) {
  const data = await adminService.hideMessage(req.user.id, req.params.messageId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function hideReply(req, res) {
  const data = await adminService.hideReply(req.user.id, req.params.replyId, req.body)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  getDashboard,
  listJoinRequests,
  handleJoinRequest,
  listMembers,
  updateMuteStatus,
  updateMemberRole,
  updateMemberIdentity,
  removeMember,
  hideMessage,
  hideReply
}
