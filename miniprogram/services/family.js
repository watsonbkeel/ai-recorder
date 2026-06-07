const request = require('../utils/request')

function createFamily(data) {
  return request({ url: '/families', method: 'POST', data })
}

function getMyFamilies() {
  return request({ url: '/families/my' })
}

function getFamilyByInvite(inviteCode) {
  const code = encodeURIComponent(String(inviteCode || '').trim())
  return request({ url: `/families/by-invite/${code}` })
}

function getFamilyMembers(familyId) {
  return request({ url: `/families/${familyId}/members` })
}

function getFamilyLayout(familyId) {
  return request({ url: `/families/${familyId}/layout` })
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
  getFamilyLayout,
  updateIdentity,
  updateFamilyNickname,
  updateRelationship,
  createJoinRequest
}
