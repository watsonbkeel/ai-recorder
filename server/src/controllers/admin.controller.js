const adminService = require('../services/admin.service')
const { sendSuccess } = require('../utils/response')

async function getDashboard(req, res) {
  const data = await adminService.getDashboard(req.user.id, req.params.classId)
  return sendSuccess(res, data, 'ok')
}

async function listJoinRequests(req, res) {
  const data = await adminService.listJoinRequests(req.user.id, req.params.classId, req.query)
  return sendSuccess(res, data, 'ok')
}

async function handleJoinRequest(req, res) {
  const data = await adminService.handleJoinRequest(req.user.id, req.params.requestId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function listMembers(req, res) {
  const data = await adminService.listMembers(req.user.id, req.params.classId)
  return sendSuccess(res, data, 'ok')
}

async function updateMuteStatus(req, res) {
  const data = await adminService.updateMuteStatus(req.user.id, req.params.classId, req.params.userId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function updateMemberRole(req, res) {
  const data = await adminService.updateMemberRole(req.user.id, req.params.classId, req.params.userId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function removeMember(req, res) {
  const data = await adminService.removeMember(req.user.id, req.params.classId, req.params.userId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function listReports(req, res) {
  const data = await adminService.listReports(req.user.id, req.params.classId, req.query)
  return sendSuccess(res, data, 'ok')
}

async function handleReport(req, res) {
  const data = await adminService.handleReport(req.user.id, req.params.reportId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function hideDiary(req, res) {
  const data = await adminService.hideDiary(req.user.id, req.params.diaryId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function hideComment(req, res) {
  const data = await adminService.hideComment(req.user.id, req.params.commentId, req.body)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  getDashboard,
  listJoinRequests,
  handleJoinRequest,
  listMembers,
  updateMuteStatus,
  updateMemberRole,
  removeMember,
  listReports,
  handleReport,
  hideDiary,
  hideComment
}
