const request = require('../utils/request')

function getDashboard(classId) {
  return request({ url: `/admin/classes/${classId}/dashboard` })
}

function getJoinRequests(classId) {
  return request({ url: `/admin/classes/${classId}/join-requests` })
}

function handleJoinRequest(requestId, data) {
  return request({ url: `/admin/join-requests/${requestId}/handle`, method: 'POST', data })
}

function getMembers(classId) {
  return request({ url: `/admin/classes/${classId}/members` })
}

function updateMute(classId, userId, data) {
  return request({ url: `/admin/classes/${classId}/members/${userId}/mute`, method: 'POST', data })
}

function updateRole(classId, userId, data) {
  return request({ url: `/admin/classes/${classId}/members/${userId}/role`, method: 'POST', data })
}

function removeMember(classId, userId, data) {
  return request({ url: `/admin/classes/${classId}/members/${userId}`, method: 'DELETE', data })
}

function getReports(classId) {
  return request({ url: `/admin/classes/${classId}/reports` })
}

function handleReport(reportId, data) {
  return request({ url: `/admin/reports/${reportId}/handle`, method: 'POST', data })
}

function hideDiary(diaryId, data) {
  return request({ url: `/admin/diaries/${diaryId}/hide`, method: 'POST', data })
}

function hideComment(commentId, data) {
  return request({ url: `/admin/comments/${commentId}/hide`, method: 'POST', data })
}

module.exports = {
  getDashboard,
  getJoinRequests,
  handleJoinRequest,
  getMembers,
  updateMute,
  updateRole,
  removeMember,
  getReports,
  handleReport,
  hideDiary,
  hideComment
}
