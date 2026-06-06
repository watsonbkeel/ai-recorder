const express = require('express')
const controller = require('../controllers/class.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.post('/', asyncHandler(controller.createClass))
router.get('/my', asyncHandler(controller.getMyClasses))
router.get('/', asyncHandler(controller.getAllClasses))
router.get('/by-invite/:inviteCode', asyncHandler(controller.getClassByInvite))
router.patch('/:classId/nickname', asyncHandler(controller.updateClassNickname))
router.post('/:classId/join-requests', asyncHandler(controller.createJoinRequest))

module.exports = router
