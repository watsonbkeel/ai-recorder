const prisma = require('../utils/prisma')

const MESSAGE_TYPE_LABELS = {
  thanks: '感谢',
  apology: '道歉',
  grievance: '委屈',
  request: '请求',
  explain: '解释',
  stress: '压力',
  repair: '修复关系',
  encouragement: '鼓励',
  general: '普通心声'
}

const MAX_EVENTS = 12
const MAX_CONTEXT_MEMORIES = 16

function asArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

function uniqueLimit(values, limit) {
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, limit)
}

function shortText(value, limit = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function countTop(values, limit) {
  const counts = new Map()
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1))
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value)
}

function memberScopeKey(memberId) {
  return `member:${Number(memberId)}`
}

function pairScopeKey(memberAId, memberBId) {
  const ids = [Number(memberAId), Number(memberBId)].sort((a, b) => a - b)
  return `pair:${ids[0]}:${ids[1]}`
}

function isParticipant(message, userId) {
  return message.senderId === Number(userId) || (message.receivers || []).some((receiver) => receiver.userId === Number(userId))
}

function messageVisibleToPair(message, userAId, userBId) {
  if (message.senderId === Number(userAId) || message.senderId === Number(userBId)) {
    return message.visibility === 'family' || isParticipant(message, message.senderId === Number(userAId) ? userBId : userAId)
  }
  return (
    (message.senderId === Number(userAId) && isParticipant(message, userBId)) ||
    (message.senderId === Number(userBId) && isParticipant(message, userAId))
  )
}

function replyVisibleToPair(message, reply, userAId, userBId) {
  if (![Number(userAId), Number(userBId)].includes(reply.senderId)) {
    return false
  }
  const otherUserId = reply.senderId === Number(userAId) ? Number(userBId) : Number(userAId)
  return message.senderId === otherUserId || (message.receivers || []).some((receiver) => receiver.userId === otherUserId)
}

function extractMessageEvent(message) {
  return {
    kind: 'message',
    messageId: message.id,
    replyId: null,
    userId: message.senderId,
    messageType: message.messageType,
    riskLevel: message.riskLevel,
    emotionTags: asArray(message.emotionTags),
    coreNeed: message.coreNeed || '',
    aiAdvice: message.aiAdvice || '',
    attackWarning: message.attackWarning || '',
    optimizedText: message.optimizedText || '',
    createdAt: message.createdAt
  }
}

function extractReplyEvent(message, reply) {
  return {
    kind: 'reply',
    messageId: message.id,
    replyId: reply.id,
    userId: reply.senderId,
    messageType: message.messageType,
    riskLevel: reply.riskLevel,
    emotionTags: asArray(reply.emotionTags),
    coreNeed: '',
    aiAdvice: reply.aiAdvice || '',
    attackWarning: reply.attackWarning || '',
    optimizedText: reply.optimizedText || '',
    createdAt: reply.createdAt
  }
}

function buildMemoryPayload(events, label) {
  const sorted = events
    .filter((event) => event.optimizedText || event.coreNeed || event.aiAdvice)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-MAX_EVENTS)

  if (!sorted.length) {
    return null
  }

  const messageTypes = countTop(sorted.map((event) => MESSAGE_TYPE_LABELS[event.messageType] || '普通心声'), 3)
  const emotions = countTop(sorted.flatMap((event) => event.emotionTags), 5)
  const coreNeeds = uniqueLimit(sorted.map((event) => shortText(event.coreNeed, 48)), 5)
  const advice = uniqueLimit(sorted.map((event) => shortText(event.aiAdvice, 64)), 5)
  const warnings = uniqueLimit(sorted.map((event) => shortText(event.attackWarning, 64)), 5)
  const sensitiveTopics = uniqueLimit([
    ...coreNeeds,
    ...emotions.filter((item) => ['委屈', '压力', '难过', '愤怒', '失望', '害怕', '不被理解'].some((keyword) => item.includes(keyword)))
  ], 6)
  const avoidPhrases = uniqueLimit([
    ...warnings,
    ...advice.filter((item) => /避免|不要|少用|慎用|放慢|先听/.test(item)),
    ...sorted
      .filter((event) => event.riskLevel !== 'low')
      .map(() => '避免指责、否定、讽刺、威胁或命令式表达')
  ], 6)
  const effectivePhrases = uniqueLimit([
    ...sorted
      .map((event) => shortText(event.optimizedText, 72))
      .filter((text) => /我希望|我感到|我理解|谢谢|对不起|我们可以|一起|先听/.test(text)),
    ...advice.filter((item) => !/避免|不要|少用|慎用/.test(item))
  ], 6)

  const summaryParts = [
    `${label}最近可用互动共 ${sorted.length} 条`,
    messageTypes.length ? `常见表达类型：${messageTypes.join('、')}` : '',
    emotions.length ? `常见情绪线索：${emotions.join('、')}` : '',
    coreNeeds.length ? `反复出现的沟通诉求：${coreNeeds.join('；')}` : '',
    effectivePhrases.length ? `较有效的表达方式：${effectivePhrases.slice(0, 3).join('；')}` : ''
  ].filter(Boolean)

  const last = sorted[sorted.length - 1]
  return {
    summary: summaryParts.join('。'),
    avoidPhrases,
    effectivePhrases,
    sensitiveTopics,
    sourceMessageCount: sorted.filter((event) => event.kind === 'message').length,
    sourceReplyCount: sorted.filter((event) => event.kind === 'reply').length,
    sourceMessageId: last.messageId || null,
    sourceReplyId: last.replyId || null
  }
}

async function upsertMemory(client, data) {
  if (!data.payload) {
    await client.familyMemory.updateMany({
      where: { familyId: data.familyId, scopeKey: data.scopeKey },
      data: { status: 'stale' }
    })
    return null
  }

  const payload = data.payload
  return client.familyMemory.upsert({
    where: { familyId_scopeKey: { familyId: data.familyId, scopeKey: data.scopeKey } },
    create: {
      familyId: data.familyId,
      scope: data.scope,
      scopeKey: data.scopeKey,
      memberId: data.memberId || null,
      relatedMemberId: data.relatedMemberId || null,
      summary: payload.summary,
      avoidPhrases: payload.avoidPhrases,
      effectivePhrases: payload.effectivePhrases,
      sensitiveTopics: payload.sensitiveTopics,
      sourceMessageCount: payload.sourceMessageCount,
      sourceReplyCount: payload.sourceReplyCount,
      sourceMessageId: payload.sourceMessageId,
      sourceReplyId: payload.sourceReplyId,
      lastRefreshedAt: new Date()
    },
    update: {
      summary: payload.summary,
      avoidPhrases: payload.avoidPhrases,
      effectivePhrases: payload.effectivePhrases,
      sensitiveTopics: payload.sensitiveTopics,
      status: 'active',
      version: { increment: 1 },
      sourceMessageCount: payload.sourceMessageCount,
      sourceReplyCount: payload.sourceReplyCount,
      sourceMessageId: payload.sourceMessageId,
      sourceReplyId: payload.sourceReplyId,
      lastRefreshedAt: new Date()
    }
  })
}

async function loadRecentMessages(familyId) {
  const messages = await prisma.familyMessage.findMany({
    where: { familyId: Number(familyId), status: 'visible' },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      receivers: { select: { userId: true } },
      replies: {
        where: { status: 'visible' },
        orderBy: { createdAt: 'asc' },
        take: 20
      }
    }
  })
  return messages.reverse()
}

function collectFamilyEvents(messages) {
  const events = []
  messages
    .filter((message) => message.visibility === 'family')
    .forEach((message) => {
      events.push(extractMessageEvent(message))
      ;(message.replies || []).forEach((reply) => events.push(extractReplyEvent(message, reply)))
    })
  return events
}

function collectMemberEvents(messages, userId) {
  const events = []
  messages
    .filter((message) => message.visibility === 'family')
    .forEach((message) => {
      if (message.senderId === Number(userId)) {
        events.push(extractMessageEvent(message))
      }
      ;(message.replies || [])
        .filter((reply) => reply.senderId === Number(userId))
        .forEach((reply) => events.push(extractReplyEvent(message, reply)))
    })
  return events
}

function collectPairEvents(messages, userAId, userBId) {
  const events = []
  messages.forEach((message) => {
    if (messageVisibleToPair(message, userAId, userBId)) {
      events.push(extractMessageEvent(message))
    }
    ;(message.replies || [])
      .filter((reply) => replyVisibleToPair(message, reply, userAId, userBId))
      .forEach((reply) => events.push(extractReplyEvent(message, reply)))
  })
  return events
}

async function getFamilyMemberByUser(familyId, userId) {
  return prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: Number(familyId), userId: Number(userId) } }
  })
}

async function refreshFamilyMemory(familyId, messages) {
  const payload = buildMemoryPayload(collectFamilyEvents(messages), '这个家庭')
  return upsertMemory(prisma, {
    familyId: Number(familyId),
    scope: 'family',
    scopeKey: 'family',
    payload
  })
}

async function refreshMemberMemory(familyId, member, messages) {
  if (!member) {
    return null
  }
  const payload = buildMemoryPayload(collectMemberEvents(messages, member.userId), '这位家人')
  return upsertMemory(prisma, {
    familyId: Number(familyId),
    scope: 'member',
    scopeKey: memberScopeKey(member.id),
    memberId: member.id,
    payload
  })
}

async function refreshPairMemory(familyId, memberA, memberB, messages) {
  if (!memberA || !memberB || memberA.id === memberB.id) {
    return null
  }
  const [firstMember, secondMember] = [memberA, memberB].sort((a, b) => a.id - b.id)
  const payload = buildMemoryPayload(collectPairEvents(messages, firstMember.userId, secondMember.userId), '这两位家人之间')
  return upsertMemory(prisma, {
    familyId: Number(familyId),
    scope: 'pair',
    scopeKey: pairScopeKey(firstMember.id, secondMember.id),
    memberId: firstMember.id,
    relatedMemberId: secondMember.id,
    payload
  })
}

async function refreshMemoriesAfterMessage(messageId) {
  const message = await prisma.familyMessage.findUnique({
    where: { id: Number(messageId) },
    include: { receivers: { select: { userId: true } } }
  })
  if (!message || message.status !== 'visible') {
    return
  }

  const messages = await loadRecentMessages(message.familyId)
  const sender = await getFamilyMemberByUser(message.familyId, message.senderId)
  const receiverMembers = await prisma.familyMember.findMany({
    where: {
      familyId: message.familyId,
      userId: { in: message.receivers.map((receiver) => receiver.userId) }
    }
  })

  const tasks = []

  if (message.visibility === 'family') {
    tasks.push(refreshFamilyMemory(message.familyId, messages))
    tasks.push(refreshMemberMemory(message.familyId, sender, messages))
  }

  receiverMembers.forEach((receiver) => {
    tasks.push(refreshPairMemory(message.familyId, sender, receiver, messages))
    if (message.visibility === 'family') {
      tasks.push(refreshMemberMemory(message.familyId, receiver, messages))
    }
  })

  await Promise.all(tasks.filter(Boolean))
}

async function refreshMemoriesAfterReply(replyId) {
  const reply = await prisma.familyReply.findUnique({
    where: { id: Number(replyId) },
    include: {
      message: {
        include: { receivers: { select: { userId: true } } }
      }
    }
  })
  if (!reply || reply.status !== 'visible' || !reply.message || reply.message.status !== 'visible') {
    return
  }

  const messages = await loadRecentMessages(reply.familyId)
  const sender = await getFamilyMemberByUser(reply.familyId, reply.senderId)
  const participantUserIds = uniqueLimit([
    reply.message.senderId,
    ...reply.message.receivers.map((receiver) => receiver.userId)
  ], 30)
    .map(Number)
    .filter((userId) => userId !== reply.senderId)
  const participantMembers = await prisma.familyMember.findMany({
    where: { familyId: reply.familyId, userId: { in: participantUserIds } }
  })

  const tasks = []
  if (reply.message.visibility === 'family') {
    tasks.push(refreshFamilyMemory(reply.familyId, messages))
    tasks.push(refreshMemberMemory(reply.familyId, sender, messages))
  }
  participantMembers.forEach((member) => {
    tasks.push(refreshPairMemory(reply.familyId, sender, member, messages))
  })

  await Promise.all(tasks)
}

async function invalidateFamilyMemories(familyId, tx) {
  const client = tx || prisma
  await client.familyMemory.updateMany({
    where: { familyId: Number(familyId), status: 'active' },
    data: { status: 'stale' }
  })
}

function mapMemoryForContext(memory) {
  return {
    id: memory.id,
    scope: memory.scope,
    scopeKey: memory.scopeKey,
    memberId: memory.memberId,
    relatedMemberId: memory.relatedMemberId,
    summary: memory.summary,
    avoidPhrases: asArray(memory.avoidPhrases),
    effectivePhrases: asArray(memory.effectivePhrases),
    sensitiveTopics: asArray(memory.sensitiveTopics),
    version: memory.version,
    updatedAt: memory.updatedAt
  }
}

async function buildFamilyMemoryContext(userId, familyId, receiverUserIds = [], enabled = true) {
  if (enabled === false) {
    return { enabled: false, memories: [] }
  }

  const currentMember = await getFamilyMemberByUser(familyId, userId)
  if (!currentMember) {
    return { enabled: true, memories: [] }
  }

  const receivers = await prisma.familyMember.findMany({
    where: {
      familyId: Number(familyId),
      userId: { in: uniqueLimit(receiverUserIds, 30).map(Number).filter((id) => id && id !== Number(userId)) }
    }
  })

  const scopeKeys = uniqueLimit([
    'family',
    memberScopeKey(currentMember.id),
    ...receivers.map((member) => memberScopeKey(member.id)),
    ...receivers.map((member) => pairScopeKey(currentMember.id, member.id))
  ], MAX_CONTEXT_MEMORIES)

  const memories = await prisma.familyMemory.findMany({
    where: {
      familyId: Number(familyId),
      status: 'active',
      scopeKey: { in: scopeKeys }
    },
    orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }],
    take: MAX_CONTEXT_MEMORIES
  })

  return {
    enabled: true,
    memories: memories.map(mapMemoryForContext)
  }
}

function scheduleMemoryRefresh(task) {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error('[family-memory] refresh failed:', error.message)
    })
}

module.exports = {
  refreshMemoriesAfterMessage,
  refreshMemoriesAfterReply,
  invalidateFamilyMemories,
  buildFamilyMemoryContext,
  scheduleMemoryRefresh
}
