const express = require('express')
const controller = require('../controllers/admin.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.get('/families/:familyId/dashboard', asyncHandler(controller.getDashboard))
router.get('/families/:familyId/join-requests', asyncHandler(controller.listJoinRequests))
router.post('/join-requests/:requestId/handle', asyncHandler(controller.handleJoinRequest))
router.get('/families/:familyId/members', asyncHandler(controller.listMembers))
router.post('/families/:familyId/members/:userId/mute', asyncHandler(controller.updateMuteStatus))
router.post('/families/:familyId/members/:userId/role', asyncHandler(controller.updateMemberRole))
router.patch('/families/:familyId/members/:userId/identity', asyncHandler(controller.updateMemberIdentity))
router.delete('/families/:familyId/members/:userId', asyncHandler(controller.removeMember))
router.post('/messages/:messageId/hide', asyncHandler(controller.hideMessage))
router.post('/replies/:replyId/hide', asyncHandler(controller.hideReply))

module.exports = router
