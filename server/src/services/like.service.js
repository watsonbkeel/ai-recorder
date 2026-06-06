const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureClassMember } = require('../middleware/auth')
const { createNotification } = require('./notification.service')

async function toggleDiaryLike(userId, diaryId) {
  const diary = await prisma.diary.findUnique({ where: { id: Number(diaryId) } })
  if (!diary || diary.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '内容不可见', 404)
  }
  await ensureClassMember(userId, diary.classId)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: { userId_targetType_targetId: { userId: Number(userId), targetType: 'diary', targetId: diary.id } }
    })

    if (existing) {
      await tx.like.delete({ where: { id: existing.id } })
      const updated = await tx.diary.update({
        where: { id: diary.id },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true }
      })
      if (updated.likeCount < 0) {
        await tx.diary.update({ where: { id: diary.id }, data: { likeCount: 0 } })
      }
      return { liked: false, likeCount: Math.max(0, updated.likeCount - (updated.likeCount < 0 ? updated.likeCount : 0)) }
    }

    await tx.like.create({
      data: { classId: diary.classId, userId: Number(userId), targetType: 'diary', targetId: diary.id }
    })
    const updated = await tx.diary.update({
      where: { id: diary.id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true, authorId: true }
    })
    if (updated.authorId !== Number(userId)) {
      await createNotification({
        receiverId: updated.authorId,
        triggerUserId: Number(userId),
        classId: diary.classId,
        type: 'diary_liked',
        title: '你的日记收到了一个赞',
        content: '有同学点赞了你的日记',
        diaryId: diary.id
      }, tx)
    }
    return { liked: true, likeCount: updated.likeCount }
  })
}

async function toggleCommentLike(userId, commentId) {
  const comment = await prisma.comment.findUnique({ where: { id: Number(commentId) } })
  if (!comment || comment.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '内容不可见', 404)
  }
  await ensureClassMember(userId, comment.classId)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: { userId_targetType_targetId: { userId: Number(userId), targetType: 'comment', targetId: comment.id } }
    })

    if (existing) {
      await tx.like.delete({ where: { id: existing.id } })
      const updated = await tx.comment.update({
        where: { id: comment.id },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true }
      })
      if (updated.likeCount < 0) {
        await tx.comment.update({ where: { id: comment.id }, data: { likeCount: 0 } })
      }
      return { liked: false, likeCount: Math.max(0, updated.likeCount - (updated.likeCount < 0 ? updated.likeCount : 0)) }
    }

    await tx.like.create({
      data: { classId: comment.classId, userId: Number(userId), targetType: 'comment', targetId: comment.id }
    })
    const updated = await tx.comment.update({
      where: { id: comment.id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true, authorId: true, diaryId: true }
    })
    if (updated.authorId !== Number(userId)) {
      await createNotification({
        receiverId: updated.authorId,
        triggerUserId: Number(userId),
        classId: comment.classId,
        type: 'comment_liked',
        title: '你的评论收到了一个赞',
        content: '有同学点赞了你的评论',
        diaryId: updated.diaryId,
        commentId: comment.id
      }, tx)
    }
    return { liked: true, likeCount: updated.likeCount }
  })
}

module.exports = {
  toggleDiaryLike,
  toggleCommentLike
}
