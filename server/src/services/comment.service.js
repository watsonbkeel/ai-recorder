const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureClassMember, ensureNotMuted } = require('../middleware/auth')
const { createNotification } = require('./notification.service')

function sanitizeAuthor(author, isAnonymous, viewerIsAdmin) {
  const classMember = author.classMembers && author.classMembers[0]
  const classNickname = classMember && classMember.classNickname ? classMember.classNickname : ''
  return {
    id: isAnonymous ? null : author.id,
    nickname: isAnonymous ? '匿名同学' : (classNickname || author.nickname || '未命名用户'),
    classNickname: isAnonymous ? '' : classNickname,
    avatarUrl: isAnonymous ? '' : (author.avatarUrl || ''),
    isAnonymous
  }
}

function sanitizeRealAuthor(author, isAnonymous, viewerIsAdmin) {
  if (!isAnonymous || !viewerIsAdmin) {
    return undefined
  }

  return {
    id: author.id,
    nickname: ((author.classMembers && author.classMembers[0] && author.classMembers[0].classNickname) || author.nickname || '未命名用户'),
    classNickname: ((author.classMembers && author.classMembers[0] && author.classMembers[0].classNickname) || ''),
    avatarUrl: author.avatarUrl || ''
  }
}

function authorSelect(classId) {
  return {
    id: true,
    nickname: true,
    avatarUrl: true,
    classMembers: {
      where: { classId: Number(classId) },
      select: { classNickname: true },
      take: 1
    }
  }
}

function mapComment(comment, viewerIsAdmin, userId, likedCommentIds) {
  const result = {
    id: comment.id,
    classId: comment.classId,
    diaryId: comment.diaryId,
    parentId: comment.parentId,
    content: comment.content,
    isAnonymous: comment.isAnonymous,
    status: comment.status,
    likeCount: Math.max(0, comment.likeCount || 0),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: sanitizeAuthor(comment.author, comment.isAnonymous, viewerIsAdmin),
    likedByMe: (likedCommentIds || new Set()).has(comment.id),
    canDelete: comment.authorId === Number(userId)
  }
  const realAuthor = sanitizeRealAuthor(comment.author, comment.isAnonymous, viewerIsAdmin)
  if (realAuthor) {
    result.realAuthor = realAuthor
  }
  return result
}

async function getVisibleDiary(diaryId) {
  const diary = await prisma.diary.findUnique({ where: { id: Number(diaryId) } })
  if (!diary || diary.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '内容不可见', 404)
  }
  return diary
}

async function countVisibleCommentThread(tx, comment) {
  if (comment.parentId) {
    return comment.status === 'visible' ? 1 : 0
  }

  return tx.comment.count({
    where: {
      diaryId: comment.diaryId,
      status: 'visible',
      OR: [{ id: comment.id }, { parentId: comment.id }]
    }
  })
}

async function softUpdateCommentThread(tx, comment, status) {
  if (comment.parentId) {
    await tx.comment.update({ where: { id: comment.id }, data: { status } })
    return
  }

  await tx.comment.updateMany({
    where: {
      diaryId: comment.diaryId,
      OR: [{ id: comment.id }, { parentId: comment.id }]
    },
    data: { status }
  })
}

async function listComments(userId, diaryId) {
  const diary = await getVisibleDiary(diaryId)
  const member = await ensureClassMember(userId, diary.classId)
  const comments = await prisma.comment.findMany({
    where: { diaryId: diary.id, status: 'visible' },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: authorSelect(diary.classId) }
    }
  })

  const likedRows = comments.length
    ? await prisma.like.findMany({
        where: {
          userId: Number(userId),
          targetType: 'comment',
          targetId: { in: comments.map((item) => item.id) }
        },
        select: { targetId: true }
      })
    : []
  const likedCommentIds = new Set(likedRows.map((item) => item.targetId))

  const map = new Map()
  const roots = []
  comments.forEach((comment) => {
    const item = { ...mapComment(comment, member.role === 'admin', userId, likedCommentIds), replies: [] }
    map.set(comment.id, item)
    if (!comment.parentId) {
      roots.push(item)
    }
  })

  comments.forEach((comment) => {
    if (comment.parentId && map.has(comment.parentId)) {
      map.get(comment.parentId).replies.push(map.get(comment.id))
    }
  })

  return roots
}

async function createComment(userId, diaryId, payload) {
  const diary = await getVisibleDiary(diaryId)
  const member = await ensureNotMuted(userId, diary.classId)
  const content = String(payload.content || '').trim()
  const isAnonymous = Boolean(payload.isAnonymous)
  const parentId = payload.parentId ? Number(payload.parentId) : null

  if (!content) {
    throw createError('VALIDATION_ERROR', '评论内容不能为空', 400)
  }

  let parentComment = null
  if (parentId) {
    parentComment = await prisma.comment.findUnique({ where: { id: parentId } })
    if (!parentComment || parentComment.diaryId !== diary.id || parentComment.status !== 'visible') {
      throw createError('NOT_FOUND', '父评论不存在', 404)
    }
    if (parentComment.parentId) {
      throw createError('VALIDATION_ERROR', '第一版只支持二级评论', 400)
    }
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        classId: diary.classId,
        diaryId: diary.id,
        authorId: Number(userId),
        parentId,
        content,
        isAnonymous
      },
      include: {
        author: { select: authorSelect(diary.classId) }
      }
    })

    await tx.diary.update({
      where: { id: diary.id },
      data: { commentCount: { increment: 1 } }
    })

    if (!parentComment && diary.authorId !== Number(userId)) {
      await createNotification({
        receiverId: diary.authorId,
        triggerUserId: isAnonymous ? null : Number(userId),
        classId: diary.classId,
        type: 'diary_commented',
        title: '你的日记收到了新评论',
        content,
        diaryId: diary.id,
        commentId: created.id
      }, tx)
    }

    if (parentComment && parentComment.authorId !== Number(userId)) {
      await createNotification({
        receiverId: parentComment.authorId,
        triggerUserId: isAnonymous ? null : Number(userId),
        classId: diary.classId,
        type: 'comment_replied',
        title: '你的评论收到了新回复',
        content,
        diaryId: diary.id,
        commentId: created.id
      }, tx)
    }

    return created
  })

  return mapComment(comment, member.role === 'admin', userId, new Set())
}

async function deleteComment(userId, commentId) {
  const comment = await prisma.comment.findUnique({ where: { id: Number(commentId) } })
  if (!comment) {
    throw createError('NOT_FOUND', '评论不存在', 404)
  }
  await ensureClassMember(userId, comment.classId)
  if (comment.authorId !== Number(userId)) {
    throw createError('FORBIDDEN', '只能删除自己的评论', 403)
  }

  await prisma.$transaction(async (tx) => {
    const decrementBy = await countVisibleCommentThread(tx, comment)
    await softUpdateCommentThread(tx, comment, 'deleted')
    const diary = await tx.diary.findUnique({ where: { id: comment.diaryId } })
    await tx.diary.update({
      where: { id: comment.diaryId },
      data: { commentCount: Math.max(0, (diary ? diary.commentCount : decrementBy) - decrementBy) }
    })
  })

  return { id: comment.id }
}

module.exports = {
  listComments,
  createComment,
  deleteComment
}
