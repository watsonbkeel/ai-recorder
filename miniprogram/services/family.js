const request = require('../utils/request')

function createFamily(data) {
  return request({ url: '/families', method: 'POST', data })
}

function getMyFamilies() {
  return request({ url: '/families/my' })
}

function getFamilyByInvite(inviteCode) {
  return request({ url: `/families/by-invite/${inviteCode}` })
}

function getFamilyMembers(familyId) {
  return request({ url: `/families/${familyId}/members` })
}

function updateIdentity(familyId, data) {
  return request({ url: `/families/${familyId}/identity`, method: 'PATCH', data })
}

function updateFamilyNickname(familyId, data) {
  return request({ url: `/families/${familyId}/nickname`, method: 'PATCH', data })
}

function updateRelationship(familyId, data) {
  return request({ url: `/families/${familyId}/relationship`, method: 'PATCH', data })
}

function createJoinRequest(familyId, data) {
  return request({ url: `/families/${familyId}/join-requests`, method: 'POST', data })
}

module.exports = {
  createFamily,
  getMyFamilies,
  getFamilyByInvite,
  getFamilyMembers,
  updateIdentity,
  updateFamilyNickname,
  updateRelationship,
  createJoinRequest
}
