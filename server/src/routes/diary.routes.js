const express = require('express')
const controller = require('../controllers/diary.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.get('/classes/:classId/diaries', asyncHandler(controller.listDiaries))
router.post('/classes/:classId/diaries', asyncHandler(controller.createDiary))
router.get('/diaries/:diaryId', asyncHandler(controller.getDiary))
router.delete('/diaries/:diaryId', asyncHandler(controller.deleteDiary))

module.exports = router
