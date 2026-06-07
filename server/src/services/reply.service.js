const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureFamilyMember, ensureFamilyNotMuted } = require('../middleware/auth')
const { createNotification } = require('./notification.service')
const { familyUserSelect, mapFamilyUser } = require('../utils/familyIdentity')
const { canViewMessage } = require('../utils/messageAccess')
const { invalidateFamilyMemories, refreshMemoriesAfterReply, scheduleMemoryRefresh } = require('./familyMemory.service')

const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high'])

function normalizeJsonArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
  }
  return []
}

function mapReply(reply, userId, viewerMember) {
  const isSender = reply.senderId === Number(userId)
  const isFamilyAdmin = viewerMember && viewerMember.role === 'admin'
  return {
    id: reply.id,
    familyId: reply.familyId,
    messageId: reply.messageId,
    originalText: isSender ? reply.originalText : null,
    optimizedText: reply.optimizedText,
    emotionTags: reply.emotionTags || [],
    aiAdvice: reply.aiAdvice || '',
    riskLevel: reply.riskLevel,
    attackWarning: reply.attackWarning || null,
    status: reply.status,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
    sender: mapFamilyUser(reply.sender, reply.familyId),
    canDelete: isSender,
    canHide: Boolean(isFamilyAdmin)
  }
}

async function getVisibleMessageForReply(userId, messageId) {
  const message = await prisma.familyMessage.findUnique({
    where: { id: Number(messageId) },
    include: { receivers: true, slotReceivers: true }
  })
  if (!message || message.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '心声不可见', 404)
  }
  const viewerMember = await ensureFamilyMember(userId, message.familyId)
  if (!canViewMessage(message, userId, viewerMember)) {
    throw createError('FORBIDDEN', '无权回复这条心声', 403)
  }
  return { message, viewerMember }
}

async function resolveReplyNotificationUserIds(message, replierId, tx) {
  const client = tx || prisma
  const numericReplierId = Number(replierId)
  let candidateIds = []

  if (message.visibility === 'family') {
    const members = await client.familyMember.findMany({
      where: { familyId: message.familyId },
      select: { userId: true }
    })
    candidateIds = members.map((member) => member.userId)
  } else {
    candidateIds = [
      message.senderId,
      ...(message.receivers || []).map((receiver) => receiver.userId)
    ]
    if (message.slotReceivers && message.slotReceivers.length) {
      const slotKeys = message.slotReceivers.map((receiver) => receiver.slotKey)
      const slotMembers = await client.familyMember.findMany({
        where: {
          familyId: message.familyId,
          slotKey: { in: slotKeys }
        },
        select: { userId: true }
      })
      candidateIds.push(...slotMembers.map((member) => member.userId))
    }
  }

  const uniqueIds = Array.from(new Set(candidateIds.map(Number)))
    .filter((id) => Number.isInteger(id) && id > 0 && id !== numericReplierId)
  if (!uniqueIds.length) {
    return []
  }

  const currentMembers = await client.familyMember.findMany({
    where: { familyId: message.familyId, userId: { in: uniqueIds } },
    select: { userId: true }
  })
  return currentMembers.map((member) => member.userId)
}

async function listReplies(userId, messageId) {
  const { message, viewerMember } = await getVisibleMessageForReply(userId, messageId)
  const replies = await prisma.familyReply.findMany({
    where: { messageId: message.id, status: 'visible' },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: familyUserSelect(message.familyId) } }
  })

  return replies.map((reply) => mapReply(reply, userId, viewerMember))
}

async function createReply(userId, messageId, payload) {
  const { message } = await getVisibleMessageForReply(userId, messageId)
  const viewerMember = await ensureFamilyNotMuted(userId, message.familyId)
  const originalText = String(payload.originalText || '').trim()
  const optimizedText = String(payload.optimizedText || originalText || '').trim()
  const riskLevel = VALID_RISK_LEVELS.has(payload.riskLevel) ? payload.riskLevel : 'low'

  if (message.visibility === 'self') {
    throw createError('VALIDATION_ERROR', '仅自己留言不需要回复', 400)
  }
  if (!originalText) {
    throw createError('VALIDATION_ERROR', '回复内容不能为空', 400)
  }
  if (!optimizedText) {
    throw createError('VALIDATION_ERROR', '请先生成或填写整理后的回复', 400)
  }

  const reply = await prisma.$transaction(async (tx) => {
    const created = await tx.familyReply.create({
      data: {
        familyId: message.familyId,
        messageId: message.id,
        senderId: Number(userId),
        originalText,
        optimizedText,
        emotionTags: normalizeJsonArray(payload.emotionTags),
        aiAdvice: String(payload.aiAdvice || payload.communicationAdvice || '').trim() || null,
        riskLevel,
        attackWarning: String(payload.attackWarning || '').trim() || null
      },
      include: { sender: { select: familyUserSelect(message.familyId) } }
    })

    await tx.familyMessage.update({
      where: { id: message.id },
      data: { replyCount: { increment: 1 } }
    })

    await tx.familyMessageReceiver.updateMany({
      where: { messageId: message.id, userId: Number(userId) },
      data: { status: 'replied', repliedAt: new Date() }
    })
    if (viewerMember.slotKey) {
      await tx.familyMessageSlotReceiver.updateMany({
        where: { messageId: message.id, slotKey: viewerMember.slotKey },
        data: { status: 'replied', repliedAt: new Date() }
      })
    }

    const notifyUserIds = await resolveReplyNotificationUserIds(message, userId, tx)
    for (const receiverId of notifyUserIds) {
      await createNotification({
        receiverId,
        triggerUserId: Number(userId),
        familyId: message.familyId,
        type: 'message_replied',
        title: '家人的心声有了新回复',
        content: optimizedText.slice(0, 120),
        messageId: message.id,
        replyId: created.id
      }, tx)
    }

    return created
  })

  scheduleMemoryRefresh(() => refreshMemoriesAfterReply(reply.id))

  return mapReply(reply, userId, viewerMember)
}

async function deleteReply(userId, replyId) {
  const reply = await prisma.familyReply.findUnique({ where: { id: Number(replyId) } })
  if (!reply) {
    throw createError('NOT_FOUND', '回复不存在', 404)
  }
  if (reply.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '回复不可见', 404)
  }
  await ensureFamilyMember(userId, reply.familyId)
  if (reply.senderId !== Number(userId)) {
    throw createError('FORBIDDEN', '只能删除自己的回复', 403)
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyReply.update({ where: { id: reply.id }, data: { status: 'deleted' } })
    const message = await tx.familyMessage.findUnique({ where: { id: reply.messageId } })
    await tx.familyMessage.update({
      where: { id: reply.messageId },
      data: { replyCount: Math.max(0, (message ? message.replyCount : 1) - 1) }
    })
    await invalidateFamilyMemories(reply.familyId, tx)
  })

  return { id: reply.id }
}

module.exports = {
  listReplies,
  createReply,
  deleteReply
}
