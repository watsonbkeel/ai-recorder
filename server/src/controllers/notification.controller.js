const notificationService = require('../services/notification.service')
const { sendSuccess } = require('../utils/response')

async function listNotifications(req, res) {
  const data = await notificationService.listNotifications(req.user.id, req.query)
  return sendSuccess(res, data, 'ok')
}

async function getUnreadCount(req, res) {
  const data = await notificationService.getUnreadCount(req.user.id)
  return sendSuccess(res, data, 'ok')
}

async function markAllRead(req, res) {
  const data = await notificationService.markAllRead(req.user.id)
  return sendSuccess(res, data, 'ok')
}

async function markRead(req, res) {
  const data = await notificationService.markRead(req.user.id, req.params.notificationId)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  listNotifications,
  getUnreadCount,
  markAllRead,
  markRead
}
