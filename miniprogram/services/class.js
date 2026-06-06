const request = require('../utils/request')

function createClass(data) {
  return request({ url: '/classes', method: 'POST', data })
}

function getMyClasses() {
  return request({ url: '/classes/my' })
}

function getAllClasses() {
  return request({ url: '/classes' })
}

function getClassByInvite(inviteCode) {
  return request({ url: `/classes/by-invite/${inviteCode}` })
}

function createJoinRequest(classId, data) {
  return request({ url: `/classes/${classId}/join-requests`, method: 'POST', data })
}

function updateClassNickname(classId, data) {
  return request({ url: `/classes/${classId}/nickname`, method: 'PATCH', data })
}

module.exports = {
  createClass,
  getMyClasses,
  getAllClasses,
  getClassByInvite,
  createJoinRequest,
  updateClassNickname
}
