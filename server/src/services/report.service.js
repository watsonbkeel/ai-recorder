const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureClassMember } = require('../middleware/auth')

async function resolveReportTarget(targetType, targetId) {
  if (targetType === 'diary') {
    const diary = await prisma.diary.findUnique({ where: { id: Number(targetId) } })
    if (!diary || diary.status !== 'visible') {
      throw createError('CONTENT_NOT_VISIBLE', '内容不可见', 404)
    }
    return { classId: diary.classId, authorId: diary.authorId }
  }

  if (targetType === 'comment') {
    const comment = await prisma.comment.findUnique({ where: { id: Number(targetId) } })
    if (!comment || comment.status !== 'visible') {
      throw createError('CONTENT_NOT_VISIBLE', '内容不可见', 404)
    }
    return { classId: comment.classId, authorId: comment.authorId }
  }

  throw createError('VALIDATION_ERROR', '举报目标类型错误', 400)
}

async function createReport(userId, payload) {
  const targetType = String(payload.targetType || '')
  const targetId = Number(payload.targetId)
  const reason = String(payload.reason || '').trim()
  const description = String(payload.description || '').trim()

  if (!targetType || !targetId || !reason) {
    throw createError('VALIDATION_ERROR', '举报参数不完整', 400)
  }

  const target = await resolveReportTarget(targetType, targetId)
  await ensureClassMember(userId, target.classId)

  const report = await prisma.report.create({
    data: {
      classId: target.classId,
      reporterId: Number(userId),
      targetType,
      targetId,
      reason,
      description: description || null
    }
  })

  return {
    id: report.id,
    classId: report.classId,
    targetType: report.targetType,
    targetId: report.targetId,
    status: report.status,
    reason: report.reason,
    description: report.description
  }
}

module.exports = {
  createReport
}
