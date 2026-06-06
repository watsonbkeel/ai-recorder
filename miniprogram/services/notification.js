const request = require('../utils/request')

function getNotifications(query) {
  const page = query && query.page ? query.page : 1
  const pageSize = query && query.pageSize ? query.pageSize : 10
  return request({ url: `/notifications?page=${page}&pageSize=${pageSize}` })
}

function getUnreadCount() {
  return request({ url: '/notifications/unread-count', silent: true })
}

function markRead(notificationId) {
  return request({ url: `/notifications/${notificationId}/read`, method: 'POST' })
}

function markAllRead() {
  return request({ url: '/notifications/read-all', method: 'POST' })
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead
}
