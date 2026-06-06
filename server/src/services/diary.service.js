const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureClassMember, ensureNotMuted } = require('../middleware/auth')
const { PUBLIC_BASE_URL } = require('../config/env')

function buildPublicUrl(url) {
  if (!url) {
    return ''
  }
  if (/^https?:\/\//.test(url)) {
    return url
  }
  return `${PUBLIC_BASE_URL.replace(/\/$/, '')}${url}`
}

function getClassNickname(author) {
  const classMember = author.classMembers && author.classMembers[0]
  return classMember && classMember.classNickname ? classMember.classNickname : ''
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

function normalizePage(query) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10))
  return { page, pageSize }
}

function buildPagination(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 }
}

function sanitizeAuthor(author, isAnonymous, viewerIsAdmin) {
  const classNickname = getClassNickname(author)
  const displayName = isAnonymous ? '匿名同学' : (classNickname || author.nickname || '未命名用户')
  const displayAvatar = isAnonymous ? '' : (author.avatarUrl || '')
  return {
    id: isAnonymous ? null : author.id,
    nickname: displayName,
    classNickname: isAnonymous ? '' : classNickname,
    avatarUrl: displayAvatar,
    isAnonymous
  }
}

function sanitizeRealAuthor(author, isAnonymous, viewerIsAdmin) {
  if (!isAnonymous || !viewerIsAdmin) {
    return undefined
  }

  return {
    id: author.id,
    nickname: getClassNickname(author) || author.nickname || '未命名用户',
    classNickname: getClassNickname(author),
    avatarUrl: author.avatarUrl || ''
  }
}

function mapDiary(diary, viewerIsAdmin, currentUserId, likedDiaryIds) {
  const result = {
    id: diary.id,
    classId: diary.classId,
    content: diary.content,
    isAnonymous: diary.isAnonymous,
    status: diary.status,
    likeCount: Math.max(0, diary.likeCount || 0),
    commentCount: Math.max(0, diary.commentCount || 0),
    createdAt: diary.createdAt,
    updatedAt: diary.updatedAt,
    author: sanitizeAuthor(diary.author, diary.isAnonymous, viewerIsAdmin),
    images: (diary.images || []).map((image) => ({
      id: image.id,
      url: image.url,
      fullUrl: buildPublicUrl(image.url),
      sortOrder: image.sortOrder
    })),
    likedByMe: (likedDiaryIds || new Set()).has(diary.id),
    canDelete: diary.authorId === Number(currentUserId),
    canHide: viewerIsAdmin
  }
  const realAuthor = sanitizeRealAuthor(diary.author, diary.isAnonymous, viewerIsAdmin)
  if (realAuthor) {
    result.realAuthor = realAuthor
  }
  return result
}

async function getVisibleDiaryWithClass(diaryId) {
  const diary = await prisma.diary.findUnique({
    where: { id: Number(diaryId) },
    select: { id: true, classId: true, status: true }
  })

  if (!diary || diary.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '内容不可见', 404)
  }

  return prisma.diary.findUnique({
    where: { id: diary.id },
    include: {
      author: { select: authorSelect(diary.classId) },
      images: { orderBy: { sortOrder: 'asc' } }
    }
  })
}

async function listDiaries(userId, classId, query) {
  const member = await ensureClassMember(userId, classId)
  const { page, pageSize } = normalizePage(query)
  const where = { classId: Number(classId), status: 'visible' }

  const [total, items] = await Promise.all([
    prisma.diary.count({ where }),
    prisma.diary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: authorSelect(classId) },
        images: { orderBy: { sortOrder: 'asc' } }
      }
    })
  ])

  const likedRows = items.length
    ? await prisma.like.findMany({
        where: {
          userId: Number(userId),
          targetType: 'diary',
          targetId: { in: items.map((item) => item.id) }
        },
        select: { targetId: true }
      })
    : []
  const likedDiaryIds = new Set(likedRows.map((item) => item.targetId))

  return {
    items: items.map((item) => mapDiary(item, member.role === 'admin', userId, likedDiaryIds)),
    pagination: buildPagination(page, pageSize, total)
  }
}

async function createDiary(userId, classId, payload) {
  const member = await ensureNotMuted(userId, classId)
  const content = String(payload.content || '').trim()
  const imageUrls = Array.isArray(payload.imageUrls) ? payload.imageUrls.filter(Boolean) : []
  const isAnonymous = Boolean(payload.isAnonymous)

  if (!content) {
    throw createError('VALIDATION_ERROR', '内容不能为空', 400)
  }
  if (imageUrls.length > 9) {
    throw createError('VALIDATION_ERROR', '图片最多 9 张', 400)
  }

  const diary = await prisma.diary.create({
    data: {
      classId: Number(classId),
      authorId: Number(userId),
      content,
      isAnonymous,
      images: {
        create: imageUrls.map((url, index) => ({ url, sortOrder: index }))
      }
    },
    include: {
      author: { select: authorSelect(classId) },
      images: { orderBy: { sortOrder: 'asc' } }
    }
  })

  return mapDiary(diary, member.role === 'admin', userId, new Set())
}

async function getDiaryDetail(userId, diaryId) {
  const diary = await getVisibleDiaryWithClass(diaryId)
  const member = await ensureClassMember(userId, diary.classId)
  const likedRows = await prisma.like.findMany({
    where: {
      userId: Number(userId),
      targetType: 'diary',
      targetId: diary.id
    },
    select: { targetId: true }
  })
  return mapDiary(diary, member.role === 'admin', userId, new Set(likedRows.map((item) => item.targetId)))
}

async function deleteDiary(userId, diaryId) {
  const diary = await prisma.diary.findUnique({ where: { id: Number(diaryId) } })
  if (!diary) {
    throw createError('NOT_FOUND', '日记不存在', 404)
  }
  await ensureClassMember(userId, diary.classId)
  if (diary.authorId !== Number(userId)) {
    throw createError('FORBIDDEN', '只能删除自己的日记', 403)
  }

  await prisma.diary.update({
    where: { id: diary.id },
    data: { status: 'deleted' }
  })

  return { id: diary.id }
}

module.exports = {
  listDiaries,
  createDiary,
  getDiaryDetail,
  deleteDiary
}
