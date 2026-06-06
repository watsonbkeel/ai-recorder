const express = require('express')
const controller = require('../controllers/admin.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.get('/classes/:classId/dashboard', asyncHandler(controller.getDashboard))
router.get('/classes/:classId/join-requests', asyncHandler(controller.listJoinRequests))
router.post('/join-requests/:requestId/handle', asyncHandler(controller.handleJoinRequest))
router.get('/classes/:classId/members', asyncHandler(controller.listMembers))
router.post('/classes/:classId/members/:userId/mute', asyncHandler(controller.updateMuteStatus))
router.post('/classes/:classId/members/:userId/role', asyncHandler(controller.updateMemberRole))
router.delete('/classes/:classId/members/:userId', asyncHandler(controller.removeMember))
router.get('/classes/:classId/reports', asyncHandler(controller.listReports))
router.post('/reports/:reportId/handle', asyncHandler(controller.handleReport))
router.post('/diaries/:diaryId/hide', asyncHandler(controller.hideDiary))
router.post('/comments/:commentId/hide', asyncHandler(controller.hideComment))

module.exports = router
