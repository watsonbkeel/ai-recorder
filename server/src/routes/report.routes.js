const express = require('express')
const controller = require('../controllers/report.controller')
const { requireAuth } = require('../middleware/auth')
const { asyncHandler } = require('../utils/errors')

const router = express.Router()

router.use(requireAuth)
router.post('/', asyncHandler(controller.createReport))

module.exports = router
