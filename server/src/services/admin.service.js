const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureFamilyAdmin } = require('../middleware/auth')
const { createNotification } = require('./notification.service')
const { normalizeIdentityPayload, mapIdentity, mapMember } = require('../utils/familyIdentity')
const { invalidateFamilyMemories } = require('./familyMemory.service')

function memberInclude() {
  return {
    user: {
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        isGlobalAdmin: true
      }
    }
  }
}

async function writeAdminLog(tx, data) {
  await tx.familyAdminLog.create({ data })
}

async function countAdmins(tx, familyId) {
  return tx.familyMember.count({ where: { familyId: Number(familyId), role: 'admin' } })
}

async function getDashboard(userId, familyId) {
  await ensureFamilyAdmin(userId, familyId)
  const numericFamilyId = Number(familyId)
  const [pendingJoinRequests, memberCount, messageCount, replyCount, mutedMemberCount] = await Promise.all([
    prisma.familyJoinRequest.count({ where: { familyId: numericFamilyId, status: 'pending' } }),
    prisma.familyMember.count({ where: { familyId: numericFamilyId } }),
    prisma.familyMessage.count({ where: { familyId: numericFamilyId, status: 'visible' } }),
    prisma.familyReply.count({ where: { familyId: numericFamilyId, status: 'visible' } }),
    prisma.familyMember.count({ where: { familyId: numericFamilyId, isMuted: true } })
  ])

  return { pendingJoinRequests, memberCount, messageCount, replyCount, mutedMemberCount }
}

async function listJoinRequests(userId, familyId, query) {
  await ensureFamilyAdmin(userId, familyId)
  const status = query && query.status ? String(query.status).trim() : ''
  const requests = await prisma.familyJoinRequest.findMany({
    where: {
      familyId: Number(familyId),
      ...(status ? { status } : {})
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { id: true, nickname: true, avatarUrl: true } },
      handledBy: { select: { id: true, nickname: true } }
    }
  })

  return requests.map((request) => ({
    id: request.id,
    familyId: request.familyId,
    userId: request.userId,
    status: request.status,
    message: request.message || '',
    handledAt: request.handledAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    ...mapIdentity(request),
    user: request.user,
    handledBy: request.handledBy
  }))
}

async function handleJoinRequest(adminUserId, requestId, payload) {
  const action = String(payload.action || '').trim()
  const reason = String(payload.reason || '').trim()
  const request = await prisma.familyJoinRequest.findUnique({ where: { id: Number(requestId) } })
  if (!request) {
    throw createError('NOT_FOUND', '申请不存在', 404)
  }
  await ensureFamilyAdmin(adminUserId, request.familyId)
  if (request.status !== 'pending') {
    throw createError('VALIDATION_ERROR', '该申请已处理', 400)
  }
  if (!['approve', 'reject'].includes(action)) {
    throw createError('VALIDATION_ERROR', '处理动作不合法', 400)
  }

  return prisma.$transaction(async (tx) => {
    const status = action === 'approve' ? 'approved' : 'rejected'
    const updatedRequest = await tx.familyJoinRequest.update({
      where: { id: request.id },
      data: { status, handledById: Number(adminUserId), handledAt: new Date() }
    })

    if (action === 'approve') {
      const existingMember = await tx.familyMember.findUnique({
        where: { familyId_userId: { familyId: request.familyId, userId: request.userId } }
      })
      if (!existingMember) {
        await tx.familyMember.create({
          data: {
            familyId: request.familyId,
            userId: request.userId,
            role: 'member',
            relationship: request.relationship,
            gender: request.gender,
            childOrder: request.childOrder,
            birthYear: request.birthYear,
            familyNickname: request.familyNickname,
            preferredTitle: request.preferredTitle,
            identityNote: request.identityNote
          }
        })
      }
      await createNotification({
        receiverId: request.userId,
        triggerUserId: Number(adminUserId),
        familyId: request.familyId,
        type: 'join_request_approved',
        title: '你的入家申请已通过',
        content: '管理员已确认你的家庭身份。'
      }, tx)
      await writeAdminLog(tx, {
        familyId: request.familyId,
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
        familyId: request.familyId,
        type: 'join_request_rejected',
        title: '你的入家申请未通过',
        content: reason || '管理员暂未通过你的入家申请。'
      }, tx)
      await writeAdminLog(tx, {
        familyId: request.familyId,
        adminId: Number(adminUserId),
        targetType: 'join_request',
        targetId: request.id,
        action: 'reject_join_request',
        reason: reason || null
      })
    }

    return {
      ...updatedRequest,
      ...mapIdentity(updatedRequest)
    }
  })
}

async function listMembers(userId, familyId) {
  await ensureFamilyAdmin(userId, familyId)
  const members = await prisma.familyMember.findMany({
    where: { familyId: Number(familyId) },
    orderBy: [
      { role: 'desc' },
      { relationship: 'asc' },
      { childOrder: 'asc' },
      { joinedAt: 'asc' }
    ],
    include: memberInclude()
  })
  return members.map((member) => mapMember(member, userId))
}

async function updateMuteStatus(adminUserId, familyId, targetUserId, payload) {
  await ensureFamilyAdmin(adminUserId, familyId)
  const isMuted = Boolean(payload.isMuted)
  const reason = String(payload.reason || '').trim()
  const numericFamilyId = Number(familyId)
  const numericUserId = Number(targetUserId)

  if (numericUserId === Number(adminUserId)) {
    throw createError('FORBIDDEN', '管理员不能停用自己', 403)
  }

  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: numericFamilyId, userId: numericUserId } }
  })
  if (!member) {
    throw createError('NOT_FOUND', '成员不存在', 404)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.familyMember.update({
      where: { id: member.id },
      data: { isMuted },
      include: memberInclude()
    })
    await writeAdminLog(tx, {
      familyId: numericFamilyId,
      adminId: Number(adminUserId),
      targetType: 'member',
      targetId: numericUserId,
      action: isMuted ? 'mute_member' : 'unmute_member',
      reason: reason || null
    })
    return mapMember(updated, adminUserId)
  })
}

async function updateMemberRole(adminUserId, familyId, targetUserId, payload) {
  await ensureFamilyAdmin(adminUserId, familyId)
  const role = String(payload.role || '').trim()
  const reason = String(payload.reason || '').trim()
  const numericFamilyId = Number(familyId)
  const numericUserId = Number(targetUserId)

  if (!['member', 'admin'].includes(role)) {
    throw createError('VALIDATION_ERROR', '角色不合法', 400)
  }

  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: numericFamilyId, userId: numericUserId } }
  })
  if (!member) {
    throw createError('NOT_FOUND', '成员不存在', 404)
  }

  return prisma.$transaction(async (tx) => {
    if (member.role === 'admin' && role === 'member') {
      const adminCount = await countAdmins(tx, numericFamilyId)
      if (adminCount <= 1) {
        throw createError('FORBIDDEN', '不能取消最后一个管理员', 403)
      }
    }

    const updated = await tx.familyMember.update({
      where: { id: member.id },
      data: { role },
      include: memberInclude()
    })

    await writeAdminLog(tx, {
      familyId: numericFamilyId,
      adminId: Number(adminUserId),
      targetType: 'member',
      targetId: numericUserId,
      action: role === 'admin' ? 'set_admin' : 'unset_admin',
      reason: reason || null
    })
    return mapMember(updated, adminUserId)
  })
}

async function updateMemberIdentity(adminUserId, familyId, targetUserId, payload) {
  await ensureFamilyAdmin(adminUserId, familyId)
  const numericFamilyId = Number(familyId)
  const numericUserId = Number(targetUserId)
  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: numericFamilyId, userId: numericUserId } }
  })
  if (!member) {
    throw createError('NOT_FOUND', '成员不存在', 404)
  }

  const identity = normalizeIdentityPayload(payload)
  return prisma.$transaction(async (tx) => {
    const updated = await tx.familyMember.update({
      where: { id: member.id },
      data: identity,
      include: memberInclude()
    })
    await writeAdminLog(tx, {
      familyId: numericFamilyId,
      adminId: Number(adminUserId),
      targetType: 'member',
      targetId: numericUserId,
      action: 'update_member_identity',
      reason: String(payload.reason || '').trim() || null,
      metadata: identity
    })
    return mapMember(updated, adminUserId)
  })
}

async function removeMember(adminUserId, familyId, targetUserId, payload) {
  await ensureFamilyAdmin(adminUserId, familyId)
  const reason = String((payload && payload.reason) || '').trim()
  const numericFamilyId = Number(familyId)
  const numericUserId = Number(targetUserId)

  if (numericUserId === Number(adminUserId)) {
    throw createError('FORBIDDEN', '管理员不能移除自己', 403)
  }

  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: numericFamilyId, userId: numericUserId } }
  })
  if (!member) {
    throw createError('NOT_FOUND', '成员不存在', 404)
  }

  return prisma.$transaction(async (tx) => {
    if (member.role === 'admin') {
      const adminCount = await countAdmins(tx, numericFamilyId)
      if (adminCount <= 1) {
        throw createError('FORBIDDEN', '不能移除最后一个管理员', 403)
      }
    }

    await tx.familyMember.delete({ where: { id: member.id } })
    await invalidateFamilyMemories(numericFamilyId, tx)
    await writeAdminLog(tx, {
      familyId: numericFamilyId,
      adminId: Number(adminUserId),
      targetType: 'member',
      targetId: numericUserId,
      action: 'remove_member',
      reason: reason || null
    })
    return { familyId: numericFamilyId, userId: numericUserId }
  })
}

async function hideMessage(adminUserId, messageId, payload) {
  const reason = String((payload && payload.reason) || '').trim()
  const message = await prisma.familyMessage.findUnique({ where: { id: Number(messageId) } })
  if (!message) {
    throw createError('NOT_FOUND', '心声不存在', 404)
  }
  if (message.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '心声不可见', 404)
  }
  await ensureFamilyAdmin(adminUserId, message.familyId)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.familyMessage.update({
      where: { id: message.id },
      data: { status: 'hidden' }
    })
    await invalidateFamilyMemories(message.familyId, tx)
    await writeAdminLog(tx, {
      familyId: message.familyId,
      adminId: Number(adminUserId),
      targetType: 'message',
      targetId: message.id,
      action: 'hide_message',
      reason: reason || null
    })
    return updated
  })
}

async function hideReply(adminUserId, replyId, payload) {
  const reason = String((payload && payload.reason) || '').trim()
  const reply = await prisma.familyReply.findUnique({ where: { id: Number(replyId) } })
  if (!reply) {
    throw createError('NOT_FOUND', '回复不存在', 404)
  }
  if (reply.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '回复不可见', 404)
  }
  await ensureFamilyAdmin(adminUserId, reply.familyId)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.familyReply.update({
      where: { id: reply.id },
      data: { status: 'hidden' }
    })
    const message = await tx.familyMessage.findUnique({ where: { id: reply.messageId } })
    if (message) {
      await tx.familyMessage.update({
        where: { id: reply.messageId },
        data: { replyCount: Math.max(0, message.replyCount - 1) }
      })
    }
    await invalidateFamilyMemories(reply.familyId, tx)
    await writeAdminLog(tx, {
      familyId: reply.familyId,
      adminId: Number(adminUserId),
      targetType: 'reply',
      targetId: reply.id,
      action: 'hide_reply',
      reason: reason || null
    })
    return updated
  })
}

module.exports = {
  getDashboard,
  listJoinRequests,
  handleJoinRequest,
  listMembers,
  updateMuteStatus,
  updateMemberRole,
  updateMemberIdentity,
  removeMember,
  hideMessage,
  hideReply
}
