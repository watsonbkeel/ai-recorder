const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureClassAdmin } = require('../middleware/auth')
const { createNotification } = require('./notification.service')

function realAuthor(author) {
  return {
    id: author.id,
    nickname: author.nickname || '未命名用户',
    avatarUrl: author.avatarUrl || ''
  }
}

function reportTargetAuthor(author, isAnonymous) {
  if (!isAnonymous) {
    return realAuthor(author)
  }

  return {
    id: null,
    nickname: '匿名同学',
    avatarUrl: ''
  }
}

async function writeModerationLog(tx, data) {
  await tx.moderationLog.create({ data })
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

async function softHideCommentThread(tx, comment) {
  if (comment.parentId) {
    await tx.comment.update({ where: { id: comment.id }, data: { status: 'hidden' } })
    return
  }

  await tx.comment.updateMany({
    where: {
      diaryId: comment.diaryId,
      OR: [{ id: comment.id }, { parentId: comment.id }]
    },
    data: { status: 'hidden' }
  })
}

async function decrementDiaryCommentCountIfNeeded(tx, comment) {
  const decrementBy = await countVisibleCommentThread(tx, comment)
  if (!decrementBy) {
    return
  }
  const diary = await tx.diary.findUnique({ where: { id: Number(comment.diaryId) } })
  if (!diary) {
    return
  }
  await tx.diary.update({
    where: { id: diary.id },
    data: { commentCount: Math.max(0, diary.commentCount - decrementBy) }
  })
}

async function countAdmins(tx, classId) {
  return tx.classMember.count({ where: { classId: Number(classId), role: 'admin' } })
}

async function getDashboard(userId, classId) {
  await ensureClassAdmin(userId, classId)
  const numericClassId = Number(classId)
  const [pendingJoinRequests, pendingReports, memberCount, diaryCount] = await Promise.all([
    prisma.joinRequest.count({ where: { classId: numericClassId, status: 'pending' } }),
    prisma.report.count({ where: { classId: numericClassId, status: 'pending' } }),
    prisma.classMember.count({ where: { classId: numericClassId } }),
    prisma.diary.count({ where: { classId: numericClassId, status: 'visible' } })
  ])

  return { pendingJoinRequests, pendingReports, memberCount, diaryCount }
}

async function listJoinRequests(userId, classId, query) {
  await ensureClassAdmin(userId, classId)
  const status = query && query.status ? String(query.status).trim() : ''
  return prisma.joinRequest.findMany({
    where: {
      classId: Number(classId),
      ...(status ? { status } : {})
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
      handledBy: { select: { id: true, nickname: true } }
    }
  })
}

async function handleJoinRequest(adminUserId, requestId, payload) {
  const action = String(payload.action || '').trim()
  const reason = String(payload.reason || '').trim()
  const request = await prisma.joinRequest.findUnique({ where: { id: Number(requestId) } })
  if (!request) {
    throw createError('NOT_FOUND', '申请不存在', 404)
  }
  await ensureClassAdmin(adminUserId, request.classId)
  if (request.status !== 'pending') {
    throw createError('VALIDATION_ERROR', '该申请已处理', 400)
  }
  if (!['approve', 'reject'].includes(action)) {
    throw createError('VALIDATION_ERROR', '处理动作不合法', 400)
  }

  return prisma.$transaction(async (tx) => {
    const status = action === 'approve' ? 'approved' : 'rejected'
    const updatedRequest = await tx.joinRequest.update({
      where: { id: request.id },
      data: { status, handledById: Number(adminUserId), handledAt: new Date() }
    })

    if (action === 'approve') {
      const existingMember = await tx.classMember.findUnique({
        where: { classId_userId: { classId: request.classId, userId: request.userId } }
      })
      if (!existingMember) {
        await tx.classMember.create({
          data: { classId: request.classId, userId: request.userId, role: 'member' }
        })
      }
      await createNotification({
        receiverId: request.userId,
        triggerUserId: Number(adminUserId),
        classId: request.classId,
        type: 'join_request_approved',
        title: '你的入班申请已通过',
        content: '管理员已通过你的入班申请'
      }, tx)
      await writeModerationLog(tx, {
        classId: request.classId,
        adminId: Number(adminUserId),
        targetType: 'join_request',
        targetId: request.id,
        action: 'approve_join_request',
        reason: reason || null
      })
    } else {
      await createNotification({
        receiverId: request.userId,
        triggerUserId: Number(adminUserId),
        classId: request.classId,
        type: 'join_request_rejected',
        title: '你的入班申请被拒绝',
        content: reason || '管理员拒绝了你的入班申请'
      }, tx)
      await writeModerationLog(tx, {
        classId: request.classId,
        adminId: Number(adminUserId),
        targetType: 'join_request',
        targetId: request.id,
        action: 'reject_join_request',
        reason: reason || null
      })
    }

    return updatedRequest
  })
}

async function listMembers(userId, classId) {
  await ensureClassAdmin(userId, classId)
  return prisma.classMember.findMany({
    where: { classId: Number(classId) },
    orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
    include: { user: { select: { id: true, nickname: true, avatarUrl: true, isGlobalAdmin: true } } }
  })
}

async function updateMuteStatus(adminUserId, classId, targetUserId, payload) {
  await ensureClassAdmin(adminUserId, classId)
  const isMuted = Boolean(payload.isMuted)
  const reason = String(payload.reason || '').trim()
  const numericClassId = Number(classId)
  const numericUserId = Number(targetUserId)

  if (numericUserId === Number(adminUserId)) {
    throw createError('FORBIDDEN', '管理员不能禁言自己', 403)
  }

  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId: numericClassId, userId: numericUserId } }
  })
  if (!member) {
    throw createError('NOT_FOUND', '成员不存在', 404)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.classMember.update({
      where: { id: member.id },
      data: { isMuted }
    })
    await writeModerationLog(tx, {
      classId: numericClassId,
      adminId: Number(adminUserId),
      targetType: 'member',
      targetId: numericUserId,
      action: isMuted ? 'mute_member' : 'unmute_member',
      reason: reason || null
    })
    return updated
  })
}

async function updateMemberRole(adminUserId, classId, targetUserId, payload) {
  await ensureClassAdmin(adminUserId, classId)
  const role = String(payload.role || '').trim()
  const reason = String(payload.reason || '').trim()
  const numericClassId = Number(classId)
  const numericUserId = Number(targetUserId)

  if (!['member', 'admin'].includes(role)) {
    throw createError('VALIDATION_ERROR', '角色不合法', 400)
  }

  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId: numericClassId, userId: numericUserId } }
  })
  if (!member) {
    throw createError('NOT_FOUND', '成员不存在', 404)
  }

  return prisma.$transaction(async (tx) => {
    if (member.role === 'admin' && role === 'member') {
      const adminCount = await countAdmins(tx, numericClassId)
      if (adminCount <= 1) {
        throw createError('FORBIDDEN', '不能取消最后一个管理员', 403)
      }
    }

    const updated = await tx.classMember.update({
      where: { id: member.id },
      data: { role }
    })

    await writeModerationLog(tx, {
      classId: numericClassId,
      adminId: Number(adminUserId),
      targetType: 'member',
      targetId: numericUserId,
      action: role === 'admin' ? 'set_admin' : 'unset_admin',
      reason: reason || null
    })
    return updated
  })
}

async function removeMember(adminUserId, classId, targetUserId, payload) {
  await ensureClassAdmin(adminUserId, classId)
  const reason = String((payload && payload.reason) || '').trim()
  const numericClassId = Number(classId)
  const numericUserId = Number(targetUserId)

  if (numericUserId === Number(adminUserId)) {
    throw createError('FORBIDDEN', '管理员不能移除自己', 403)
  }

  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId: numericClassId, userId: numericUserId } }
  })
  if (!member) {
    throw createError('NOT_FOUND', '成员不存在', 404)
  }

  return prisma.$transaction(async (tx) => {
    if (member.role === 'admin') {
      const adminCount = await countAdmins(tx, numericClassId)
      if (adminCount <= 1) {
        throw createError('FORBIDDEN', '不能移除最后一个管理员', 403)
      }
    }

    await tx.classMember.delete({ where: { id: member.id } })
    await writeModerationLog(tx, {
      classId: numericClassId,
      adminId: Number(adminUserId),
      targetType: 'member',
      targetId: numericUserId,
      action: 'remove_member',
      reason: reason || null
    })
    return { classId: numericClassId, userId: numericUserId }
  })
}

async function getReportTargetDetail(report) {
  if (report.targetType === 'diary') {
    const diary = await prisma.diary.findUnique({
      where: { id: report.targetId },
      include: {
        author: { select: { id: true, nickname: true, avatarUrl: true } },
        images: { orderBy: { sortOrder: 'asc' } }
      }
    })
    if (!diary) {
      return null
    }
    const target = {
      id: diary.id,
      type: 'diary',
      status: diary.status,
      content: diary.content,
      isAnonymous: diary.isAnonymous,
      images: diary.images,
      author: reportTargetAuthor(diary.author, diary.isAnonymous)
    }
    if (diary.isAnonymous) {
      target.realAuthor = realAuthor(diary.author)
    }
    return target
  }

  const comment = await prisma.comment.findUnique({
    where: { id: report.targetId },
    include: { author: { select: { id: true, nickname: true, avatarUrl: true } } }
  })

  if (!comment) {
    return null
  }

  const target = {
    id: comment.id,
    type: 'comment',
    status: comment.status,
    content: comment.content,
    isAnonymous: comment.isAnonymous,
    diaryId: comment.diaryId,
    author: reportTargetAuthor(comment.author, comment.isAnonymous)
  }
  if (comment.isAnonymous) {
    target.realAuthor = realAuthor(comment.author)
  }
  return target
}

async function listReports(userId, classId, query) {
  await ensureClassAdmin(userId, classId)
  const status = query && query.status ? String(query.status).trim() : ''
  const reports = await prisma.report.findMany({
    where: {
      classId: Number(classId),
      ...(status ? { status } : {})
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      reporter: { select: { id: true, nickname: true, avatarUrl: true } },
      handledBy: { select: { id: true, nickname: true } }
    }
  })

  const enriched = []
  for (const report of reports) {
    const target = await getReportTargetDetail(report)
    enriched.push({
      ...report,
      reporter: report.reporter,
      handledBy: report.handledBy,
      target
    })
  }
  return enriched
}

async function hideDiary(adminUserId, diaryId, payload) {
  const reason = String(payload.reason || '').trim()
  const diary = await prisma.diary.findUnique({ where: { id: Number(diaryId) } })
  if (!diary) {
    throw createError('NOT_FOUND', '日记不存在', 404)
  }
  await ensureClassAdmin(adminUserId, diary.classId)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.diary.update({ where: { id: diary.id }, data: { status: 'hidden' } })
    await writeModerationLog(tx, {
      classId: diary.classId,
      adminId: Number(adminUserId),
      targetType: 'diary',
      targetId: diary.id,
      action: 'hide_diary',
      reason: reason || null
    })
    return updated
  })
}

async function hideComment(adminUserId, commentId, payload) {
  const reason = String(payload.reason || '').trim()
  const comment = await prisma.comment.findUnique({ where: { id: Number(commentId) } })
  if (!comment) {
    throw createError('NOT_FOUND', '评论不存在', 404)
  }
  await ensureClassAdmin(adminUserId, comment.classId)

  return prisma.$transaction(async (tx) => {
    await decrementDiaryCommentCountIfNeeded(tx, comment)
    await softHideCommentThread(tx, comment)
    const updated = await tx.comment.findUnique({ where: { id: comment.id } })
    await writeModerationLog(tx, {
      classId: comment.classId,
      adminId: Number(adminUserId),
      targetType: 'comment',
      targetId: comment.id,
      action: 'hide_comment',
      reason: reason || null
    })
    return updated
  })
}

async function handleReport(adminUserId, reportId, payload) {
  const action = String(payload.action || '').trim()
  const reason = String(payload.reason || '').trim()
  const muteAuthor = Boolean(payload.muteAuthor)
  const report = await prisma.report.findUnique({ where: { id: Number(reportId) } })
  if (!report) {
    throw createError('NOT_FOUND', '举报不存在', 404)
  }
  await ensureClassAdmin(adminUserId, report.classId)
  if (report.status !== 'pending') {
    throw createError('VALIDATION_ERROR', '举报已处理', 400)
  }

  if (!['reject', 'hide_content', 'hide', 'hide_and_mute'].includes(action)) {
    throw createError('VALIDATION_ERROR', '处理动作不合法', 400)
  }

  return prisma.$transaction(async (tx) => {
    let targetAuthorId = null

    if (report.targetType === 'diary') {
      const diary = await tx.diary.findUnique({ where: { id: report.targetId } })
      if (diary) {
        targetAuthorId = diary.authorId
        if (action !== 'reject') {
          await tx.diary.update({ where: { id: diary.id }, data: { status: 'hidden' } })
        }
      }
    }

    if (report.targetType === 'comment') {
      const comment = await tx.comment.findUnique({ where: { id: report.targetId } })
      if (comment) {
        targetAuthorId = comment.authorId
        if (action !== 'reject') {
          await decrementDiaryCommentCountIfNeeded(tx, comment)
          await softHideCommentThread(tx, comment)
        }
      }
    }

    if ((action === 'hide_and_mute' || (action === 'hide_content' && muteAuthor)) && targetAuthorId) {
      await tx.classMember.updateMany({
        where: { classId: report.classId, userId: targetAuthorId },
        data: { isMuted: true }
      })
      await writeModerationLog(tx, {
        classId: report.classId,
        adminId: Number(adminUserId),
        targetType: 'member',
        targetId: targetAuthorId,
        action: 'mute_member',
        reason: reason || '举报处理时禁言'
      })
    }

    const status = action === 'reject' ? 'rejected' : 'resolved'
    const updatedReport = await tx.report.update({
      where: { id: report.id },
      data: {
        status,
        resolution: reason || null,
        handledById: Number(adminUserId),
        handledAt: new Date()
      }
    })

    await createNotification({
      receiverId: report.reporterId,
      triggerUserId: Number(adminUserId),
      classId: report.classId,
      type: 'report_handled',
      title: '你的举报已处理',
      content: action === 'reject' ? (reason || '管理员驳回了举报') : (reason || '管理员已处理举报')
    }, tx)

    await writeModerationLog(tx, {
      classId: report.classId,
      adminId: Number(adminUserId),
      targetType: 'report',
      targetId: report.id,
      action: action === 'reject' ? 'reject_report' : 'resolve_report',
      reason: reason || null,
      metadata: { handleAction: action, muteAuthor }
    })

    return updatedReport
  })
}

module.exports = {
  getDashboard,
  listJoinRequests,
  handleJoinRequest,
  listMembers,
  updateMuteStatus,
  updateMemberRole,
  removeMember,
  listReports,
  handleReport,
  hideDiary,
  hideComment
}
