const express = require('express')
const controller = require('../controllers/reply.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.get('/messages/:messageId/replies', asyncHandler(controller.listReplies))
router.post('/messages/:messageId/replies', asyncHandler(controller.createReply))
router.delete('/replies/:replyId', asyncHandler(controller.deleteReply))

module.exports = router
