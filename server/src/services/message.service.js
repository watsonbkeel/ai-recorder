const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureFamilyMember, ensureFamilyNotMuted } = require('../middleware/auth')
const { createNotification } = require('./notification.service')
const { familyUserSelect, identitySelect, mapFamilyUser } = require('../utils/familyIdentity')
const { invalidateFamilyMemories, refreshMemoriesAfterMessage, scheduleMemoryRefresh } = require('./familyMemory.service')

const VALID_VISIBILITIES = new Set(['private', 'family', 'self'])
const VALID_MESSAGE_TYPES = new Set(['thanks', 'apology', 'grievance', 'request', 'explain', 'stress', 'repair', 'encouragement', 'general'])
const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high'])

function normalizePage(query) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10))
  return { page, pageSize }
}

function buildPagination(page, pageSize, total) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 }
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
  }
  return []
}

function canViewMessage(message, userId) {
  const numericUserId = Number(userId)
  if (message.senderId === numericUserId) {
    return true
  }
  if (message.visibility === 'family') {
    return true
  }
  return (message.receivers || []).some((receiver) => receiver.userId === numericUserId)
}

function mapMessage(message, userId) {
  const isSender = message.senderId === Number(userId)
  const canViewOriginalText = isSender || message.allowOriginalTextView
  const canPlayOriginalAudio = isSender || message.allowOriginalAudioPlay

  return {
    id: message.id,
    familyId: message.familyId,
    visibility: message.visibility,
    messageType: message.messageType,
    optimizedText: message.optimizedText,
    originalText: canViewOriginalText ? message.originalText : null,
    originalAudioUrl: canPlayOriginalAudio ? message.originalAudioUrl : null,
    audioDurationSec: canPlayOriginalAudio ? message.audioDurationSec : null,
    emotionTags: message.emotionTags || [],
    coreNeed: message.coreNeed || '',
    aiAdvice: message.aiAdvice || '',
    riskLevel: message.riskLevel,
    attackWarning: message.attackWarning || null,
    allowOriginalTextView: message.allowOriginalTextView,
    allowOriginalAudioPlay: message.allowOriginalAudioPlay,
    replyCount: Math.max(0, message.replyCount || 0),
    status: message.status,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    sender: mapFamilyUser(message.sender, message.familyId),
    receivers: (message.receivers || []).map((receiver) => ({
      id: receiver.userId,
      status: receiver.status,
      readAt: receiver.readAt,
      user: receiver.user ? mapFamilyUser(receiver.user, message.familyId) : null
    })),
    canDelete: isSender
  }
}

async function listMessages(userId, familyId, query) {
  await ensureFamilyMember(userId, familyId)
  const { page, pageSize } = normalizePage(query)
  const where = {
    familyId: Number(familyId),
    status: 'visible',
    OR: [
      { senderId: Number(userId) },
      { visibility: 'family' },
      { receivers: { some: { userId: Number(userId) } } }
    ]
  }

  const [total, items] = await Promise.all([
    prisma.familyMessage.count({ where }),
    prisma.familyMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sender: { select: familyUserSelect(familyId) },
        receivers: {
          include: { user: { select: familyUserSelect(familyId) } }
        }
      }
    })
  ])

  return {
    items: items.map((item) => mapMessage(item, userId)),
    pagination: buildPagination(page, pageSize, total)
  }
}

async function validateReceivers(familyId, senderId, receiverIds, visibility) {
  if (visibility === 'self') {
    return []
  }

  const normalizedIds = Array.from(new Set((receiverIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0 && id !== Number(senderId))))
  if (visibility === 'private' && normalizedIds.length === 0) {
    throw createError('VALIDATION_ERROR', '请选择接收家人', 400)
  }

  if (normalizedIds.length === 0) {
    return []
  }

  const members = await prisma.familyMember.findMany({
    where: { familyId: Number(familyId), userId: { in: normalizedIds } },
    select: { userId: true }
  })
  if (members.length !== normalizedIds.length) {
    throw createError('VALIDATION_ERROR', '接收人必须是家庭成员', 400)
  }
  return normalizedIds
}

async function createMessage(userId, familyId, payload) {
  await ensureFamilyNotMuted(userId, familyId)
  const visibility = VALID_VISIBILITIES.has(payload.visibility) ? payload.visibility : 'private'
  const messageType = VALID_MESSAGE_TYPES.has(payload.messageType) ? payload.messageType : 'general'
  const riskLevel = VALID_RISK_LEVELS.has(payload.riskLevel) ? payload.riskLevel : 'low'
  const originalText = String(payload.originalText || '').trim()
  const originalAudioUrl = String(payload.originalAudioUrl || '').trim()
  const optimizedText = String(payload.optimizedText || originalText || '').trim()
  const receiverIds = await validateReceivers(familyId, userId, payload.receiverIds, visibility)

  if (!originalText && !originalAudioUrl) {
    throw createError('VALIDATION_ERROR', '请先写下心声或录制语音', 400)
  }
  if (!optimizedText) {
    throw createError('VALIDATION_ERROR', '请先生成或填写整理后的表达', 400)
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.familyMessage.create({
      data: {
        familyId: Number(familyId),
        senderId: Number(userId),
        visibility,
        messageType,
        originalText: originalText || null,
        originalAudioUrl: originalAudioUrl || null,
        audioDurationSec: payload.audioDurationSec ? Number(payload.audioDurationSec) : null,
        optimizedText,
        emotionTags: normalizeJsonArray(payload.emotionTags),
        coreNeed: String(payload.coreNeed || '').trim() || null,
        aiAdvice: String(payload.aiAdvice || payload.communicationAdvice || '').trim() || null,
        riskLevel,
        attackWarning: String(payload.attackWarning || '').trim() || null,
        allowOriginalTextView: Boolean(payload.allowOriginalTextView),
        allowOriginalAudioPlay: Boolean(payload.allowOriginalAudioPlay),
        receivers: {
          create: receiverIds.map((receiverId) => ({ userId: receiverId }))
        }
      },
      include: {
        sender: { select: familyUserSelect(familyId) },
        receivers: { include: { user: { select: familyUserSelect(familyId) } } }
      }
    })

    for (const receiverId of receiverIds) {
      await createNotification({
        receiverId,
        triggerUserId: Number(userId),
        familyId: Number(familyId),
        type: 'message_received',
        title: '你收到了一条家人的心声',
        content: optimizedText.slice(0, 120),
        messageId: created.id
      }, tx)
    }

    return created
  })

  scheduleMemoryRefresh(() => refreshMemoriesAfterMessage(message.id))

  return mapMessage(message, userId)
}

async function getMessageDetail(userId, messageId) {
  const message = await prisma.familyMessage.findUnique({
    where: { id: Number(messageId) },
    include: {
      sender: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          familyMembers: { select: identitySelect() }
        }
      },
      receivers: {
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
              familyMembers: { select: identitySelect() }
            }
          }
        }
      }
    }
  })
  if (!message || message.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '心声不可见', 404)
  }
  await ensureFamilyMember(userId, message.familyId)
  if (!canViewMessage(message, userId)) {
    throw createError('FORBIDDEN', '无权查看这条心声', 403)
  }

  await prisma.familyMessageReceiver.updateMany({
    where: { messageId: message.id, userId: Number(userId), status: 'unread' },
    data: { status: 'read', readAt: new Date() }
  })

  return mapMessage(message, userId)
}

async function deleteMessage(userId, messageId) {
  const message = await prisma.familyMessage.findUnique({ where: { id: Number(messageId) } })
  if (!message) {
    throw createError('NOT_FOUND', '心声不存在', 404)
  }
  await ensureFamilyMember(userId, message.familyId)
  if (message.senderId !== Number(userId)) {
    throw createError('FORBIDDEN', '只能删除自己的心声', 403)
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyMessage.update({
      where: { id: message.id },
      data: { status: 'deleted' }
    })
    await invalidateFamilyMemories(message.familyId, tx)
  })

  return { id: message.id }
}

module.exports = {
  listMessages,
  createMessage,
  getMessageDetail,
  deleteMessage
}
