const diaryService = require('../services/diary.service')
const { sendSuccess } = require('../utils/response')

async function listDiaries(req, res) {
  const data = await diaryService.listDiaries(req.user.id, req.params.classId, req.query)
  return sendSuccess(res, data, 'ok')
}

async function createDiary(req, res) {
  const data = await diaryService.createDiary(req.user.id, req.params.classId, req.body)
  return sendSuccess(res, data, 'ok')
}

async function getDiary(req, res) {
  const data = await diaryService.getDiaryDetail(req.user.id, req.params.diaryId)
  return sendSuccess(res, data, 'ok')
}

async function deleteDiary(req, res) {
  const data = await diaryService.deleteDiary(req.user.id, req.params.diaryId)
  return sendSuccess(res, data, 'ok')
}

module.exports = {
  listDiaries,
  createDiary,
  getDiary,
  deleteDiary
}
