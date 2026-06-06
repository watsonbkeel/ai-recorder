const express = require('express')
const controller = require('../controllers/message.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.get('/families/:familyId/messages', asyncHandler(controller.listMessages))
router.post('/families/:familyId/messages', asyncHandler(controller.createMessage))
router.get('/messages/:messageId', asyncHandler(controller.getMessage))
router.delete('/messages/:messageId', asyncHandler(controller.deleteMessage))

module.exports = router
