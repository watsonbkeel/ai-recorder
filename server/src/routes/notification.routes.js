const express = require('express')
const controller = require('../controllers/notification.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.get('/', asyncHandler(controller.listNotifications))
router.get('/unread-count', asyncHandler(controller.getUnreadCount))
router.post('/read-all', asyncHandler(controller.markAllRead))
router.post('/:notificationId/read', asyncHandler(controller.markRead))

module.exports = router
