const express = require('express')
const controller = require('../controllers/family.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.post('/', asyncHandler(controller.createFamily))
router.get('/my', asyncHandler(controller.getMyFamilies))
router.get('/by-invite/:inviteCode', asyncHandler(controller.getFamilyByInvite))
router.patch('/:familyId/nickname', asyncHandler(controller.updateFamilyNickname))
router.patch('/:familyId/relationship', asyncHandler(controller.updateRelationship))
router.post('/:familyId/join-requests', asyncHandler(controller.createJoinRequest))

module.exports = router
