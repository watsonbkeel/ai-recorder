const request = require('../utils/request')

function getDiaries(classId, query) {
  const page = query && query.page ? query.page : 1
  const pageSize = query && query.pageSize ? query.pageSize : 10
  return request({ url: `/classes/${classId}/diaries?page=${page}&pageSize=${pageSize}` })
}

function createDiary(classId, data) {
  return request({ url: `/classes/${classId}/diaries`, method: 'POST', data })
}

function getDiaryDetail(diaryId) {
  return request({ url: `/diaries/${diaryId}` })
}

function deleteDiary(diaryId) {
  return request({ url: `/diaries/${diaryId}`, method: 'DELETE' })
}

function toggleDiaryLike(diaryId) {
  return request({ url: `/diaries/${diaryId}/like`, method: 'POST' })
}

module.exports = {
  getDiaries,
  createDiary,
  getDiaryDetail,
  deleteDiary,
  toggleDiaryLike
}
