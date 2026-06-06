const familyService = require('../services/family.service')
const { sendSuccess } = require('../utils/response')

async function createFamily(req, res) {
  const data = await familyService.createFamily(req.user.id, req.body)
  return sendSuccess(res, data, 'ok')
}

async function getMyFamilies(req, res) {
  const data = await familyService.listMyFamilies(req.user.id)
  return sendSuccess(res, data, 'ok')
}

async function getFamilyByInvite(req, res) {
  const data = await familyService.getFamilyByInviteCode(req.params.inviteCode)
  return sendSuccess(res, data, 'ok')
}

async function updateFamilyNickname(req, res) {
  const data = await familyService.updateFamilyNickname(req.user.id, req.params.familyId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function updateRelationship(req, res) {
  const data = await familyService.updateRelationship(req.user.id, req.params.familyId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function createJoinRequest(req, res) {
  const data = await familyService.createJoinRequest(req.user.id, req.params.familyId, req.body)
  return sendSuccess(res, data, '申请已提交，等待家庭管理员审核')
}

module.exports = {
  createFamily,
  getMyFamilies,
  getFamilyByInvite,
  updateFamilyNickname,
  updateRelationship,
  createJoinRequest
}
