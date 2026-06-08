const request = require('../utils/request')

function getDashboard(familyId) {
  return request({ url: `/admin/families/${familyId}/dashboard` })
}

function updateInviteCode(familyId, inviteCode) {
  return request({ url: `/admin/families/${familyId}/invite-code`, method: 'PUT', data: { inviteCode } })
}

function getJoinRequests(familyId) {
  return request({ url: `/admin/families/${familyId}/join-requests` })
}

function handleJoinRequest(requestId, data) {
  return request({ url: `/admin/join-requests/${requestId}/handle`, method: 'POST', data })
}

function getMembers(familyId) {
  return request({ url: `/admin/families/${familyId}/members` })
}

function updateMute(familyId, userId, data) {
  return request({ url: `/admin/families/${familyId}/members/${userId}/mute`, method: 'POST', data })
}

function updateRole(familyId, userId, data) {
  return request({ url: `/admin/families/${familyId}/members/${userId}/role`, method: 'POST', data })
}

function updateMemberIdentity(familyId, userId, data) {
  return request({ url: `/admin/families/${familyId}/members/${userId}/identity`, method: 'PATCH', data })
}

function removeMember(familyId, userId, data) {
  return request({ url: `/admin/families/${familyId}/members/${userId}`, method: 'DELETE', data })
}

function hideMessage(messageId, data) {
  return request({ url: `/admin/messages/${messageId}/hide`, method: 'POST', data })
}

function hideReply(replyId, data) {
  return request({ url: `/admin/replies/${replyId}/hide`, method: 'POST', data })
}

module.exports = {
  getDashboard,
  updateInviteCode,
  getJoinRequests,
  handleJoinRequest,
  getMembers,
  updateMute,
  updateRole,
  updateMemberIdentity,
  removeMember,
  hideMessage,
  hideReply
}
