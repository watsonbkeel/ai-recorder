const axios = require('axios')
const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureFamilyMember } = require('../middleware/auth')
const { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_TIMEOUT_MS } = require('../config/env')
const { familyUserSelect, mapFamilyUser, mapMember } = require('../utils/familyIdentity')
const { buildFamilyMemoryContext } = require('./familyMemory.service')

function extractJson(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    throw createError('AI_PROVIDER_FAILED', 'AI 返回为空', 502)
  }

  try {
    return JSON.parse(trimmed)
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0])
    }
    throw createError('AI_PROVIDER_FAILED', 'AI 返回格式不可解析', 502)
  }
}

function normalizeRiskLevel(value) {
  return ['low', 'medium', 'high'].includes(value) ? value : 'low'
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 6) : []
}

function normalizeOptimizeResult(raw) {
  return {
    optimizedText: String(raw.optimizedText || raw.optimized_text || '').trim(),
    emotionTags: normalizeStringArray(raw.emotionTags || raw.emotion_tags),
    coreNeed: String(raw.coreNeed || raw.core_need || '').trim(),
    communicationAdvice: String(raw.communicationAdvice || raw.communication_advice || '').trim(),
    riskLevel: normalizeRiskLevel(raw.riskLevel || raw.risk_level),
    attackWarning: raw.attackWarning || raw.attack_warning ? String(raw.attackWarning || raw.attack_warning).trim() : null
  }
}

function normalizeAnalyzeResult(raw) {
  return {
    possibleEmotions: normalizeStringArray(raw.possibleEmotions || raw.possible_emotions),
    realNeeds: normalizeStringArray(raw.realNeeds || raw.real_needs),
    whatToAvoid: normalizeStringArray(raw.whatToAvoid || raw.what_to_avoid),
    suggestedResponse: String(raw.suggestedResponse || raw.suggested_response || '').trim(),
    riskLevel: normalizeRiskLevel(raw.riskLevel || raw.risk_level)
  }
}

function assertConfigured() {
  if (!OPENAI_API_KEY) {
    throw createError('AI_NOT_CONFIGURED', 'AI 服务未配置 OPENAI_API_KEY', 503)
  }
}

async function callOpenAI(systemPrompt, userPayload) {
  assertConfigured()
  const baseUrl = OPENAI_BASE_URL.replace(/\/$/, '')
  const response = await axios.post(`${baseUrl}/chat/completions`, {
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload) }
    ]
  }, {
    timeout: OPENAI_TIMEOUT_MS,
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  }).catch((error) => {
    const status = error.response ? error.response.status : 502
    throw createError('AI_PROVIDER_FAILED', `AI 服务调用失败: ${status}`, 502)
  })

  const content = response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message
    ? response.data.choices[0].message.content
    : ''
  return extractJson(content)
}

function canViewMessage(message, userId) {
  const numericUserId = Number(userId)
  if (message.senderId === numericUserId || message.visibility === 'family') {
    return true
  }
  return (message.receivers || []).some((receiver) => receiver.userId === numericUserId)
}

function normalizeReceiverIds(value, currentUserId) {
  return Array.from(new Set((value || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0 && id !== Number(currentUserId))))
    .slice(0, 20)
}

function normalizeOriginalText(value) {
  return String(value || '').trim().slice(0, 4000)
}

function sanitizeOptimizeMessagePayload(payload = {}) {
  return {
    originalText: normalizeOriginalText(payload.originalText),
    hasOriginalAudio: Boolean(payload.hasOriginalAudio),
    messageType: payload.messageType || 'general',
    familyId: Number(payload.familyId || 0) || null,
    receiverIds: normalizeReceiverIds(payload.receiverIds || [], 0),
    useFamilyMemory: payload.useFamilyMemory !== false
  }
}

function sanitizeAnalyzeMessagePayload(payload = {}, messageContext) {
  return {
    messageId: payload.messageId ? Number(payload.messageId) : null,
    useFamilyMemory: payload.useFamilyMemory !== false,
    familyContext: messageContext ? messageContext.familyContext : null,
    message: messageContext ? messageContext.message : null
  }
}

function sanitizeOptimizeReplyPayload(payload = {}, messageContext) {
  return {
    originalText: normalizeOriginalText(payload.originalText),
    messageId: payload.messageId ? Number(payload.messageId) : null,
    useFamilyMemory: payload.useFamilyMemory !== false,
    familyContext: messageContext ? messageContext.familyContext : null,
    message: messageContext ? messageContext.message : null
  }
}

async function loadFamilyMembers(familyId, currentUserId, receiverIds = []) {
  const ids = Array.from(new Set([Number(currentUserId), ...receiverIds]))
  const members = await prisma.familyMember.findMany({
    where: { familyId: Number(familyId), userId: { in: ids } },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true, isGlobalAdmin: true }
      }
    }
  })
  const mapped = members.map((member) => mapMember(member, currentUserId))
  return {
    current: mapped.find((member) => Number(member.userId) === Number(currentUserId)) || null,
    receivers: mapped.filter((member) => receiverIds.includes(Number(member.userId)))
  }
}

async function loadVisibleHistory(userId, familyId, excludeMessageId) {
  const where = {
    familyId: Number(familyId),
    status: 'visible',
    ...(excludeMessageId ? { id: { not: Number(excludeMessageId) } } : {}),
    OR: [
      { senderId: Number(userId) },
      { visibility: 'family' },
      { receivers: { some: { userId: Number(userId) } } }
    ]
  }

  const messages = await prisma.familyMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: {
      sender: { select: familyUserSelect(familyId) },
      receivers: { include: { user: { select: familyUserSelect(familyId) } } },
      replies: {
        where: { status: 'visible' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { sender: { select: familyUserSelect(familyId) } }
      }
    }
  })

  return messages.reverse().map((message) => ({
    id: message.id,
    messageType: message.messageType,
    riskLevel: message.riskLevel,
    sender: mapFamilyUser(message.sender, familyId),
    receivers: message.receivers.map((receiver) => mapFamilyUser(receiver.user, familyId)),
    optimizedText: message.optimizedText.slice(0, 300),
    coreNeed: message.coreNeed || '',
    replies: message.replies.reverse().map((reply) => ({
      id: reply.id,
      sender: mapFamilyUser(reply.sender, familyId),
      optimizedText: reply.optimizedText.slice(0, 220),
      aiAdvice: reply.aiAdvice || '',
      riskLevel: reply.riskLevel,
      createdAt: reply.createdAt
    })),
    createdAt: message.createdAt
  }))
}

async function buildFamilyContext(userId, payload, options = {}) {
  const familyId = Number(payload.familyId || options.familyId || 0)
  if (!familyId) {
    return null
  }

  await ensureFamilyMember(userId, familyId)
  const receiverIds = normalizeReceiverIds(payload.receiverIds || options.receiverIds || [], userId)
  const useFamilyMemory = payload.useFamilyMemory !== false && options.useFamilyMemory !== false
  const [family, members, history, memoryContext] = await Promise.all([
    prisma.family.findUnique({ where: { id: familyId }, select: { id: true, name: true, description: true } }),
    loadFamilyMembers(familyId, userId, receiverIds),
    loadVisibleHistory(userId, familyId, options.excludeMessageId),
    buildFamilyMemoryContext(userId, familyId, receiverIds, useFamilyMemory)
  ])

  return {
    family,
    currentMember: members.current,
    receivers: members.receivers,
    visibleRecentMessages: history,
    familyMemory: memoryContext
  }
}

async function loadMessageContext(userId, messageId, payload = {}) {
  const message = await prisma.familyMessage.findUnique({
    where: { id: Number(messageId) },
    include: {
      receivers: true
    }
  })
  if (!message || message.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '心声不可见', 404)
  }
  await ensureFamilyMember(userId, message.familyId)
  if (!canViewMessage(message, userId)) {
    throw createError('FORBIDDEN', '无权使用这条心声作为 AI 上下文', 403)
  }
  const contextReceiverIds = Array.from(new Set([
    message.senderId,
    ...message.receivers
      .map((receiver) => receiver.userId)
      .filter((receiverUserId) => Number(receiverUserId) === Number(userId) || Number(message.senderId) === Number(userId))
  ])).filter((receiverUserId) => Number(receiverUserId) !== Number(userId))

  const familyContext = await buildFamilyContext(userId, {
    familyId: message.familyId,
    receiverIds: contextReceiverIds,
    useFamilyMemory: payloadUseFamilyMemory(payload)
  }, { excludeMessageId: message.id, useFamilyMemory: payloadUseFamilyMemory(payload) })

  return {
    familyContext,
    message: {
      id: message.id,
      familyId: message.familyId,
      messageType: message.messageType,
      optimizedText: message.optimizedText,
      coreNeed: message.coreNeed || '',
      riskLevel: message.riskLevel,
      senderId: message.senderId,
      receiverIds: message.receivers.map((receiver) => receiver.userId)
    }
  }
}

function payloadUseFamilyMemory(payload) {
  return payload && payload.useFamilyMemory === false ? false : true
}

const baseRules = [
  '你是家庭沟通表达助手，只做表达翻译和理解辅助，不裁判谁对谁错。',
  '必须保留用户真实意思，不编造事实、承诺、道歉、爱意或责任。',
  '可以参考家庭身份和可见历史调整称呼、语气和表达详略，但不能按性别、排行或长幼做刻板判断。',
  '如果 familyMemory.enabled 为 false，不能使用任何家庭记忆。',
  '家庭记忆只用于沟通偏好、敏感点、有效表达方式和称呼，不做人格判断、诊断、贴标签或长期定性。',
  '只能使用上下文里已经提供的可见整理版、摘要和记忆；不能要求或推测未开放的原始文字、原始语音。',
  '不要鼓励忍耐伤害、家暴、羞辱、控制或情绪勒索。',
  '如果存在自伤、家暴、威胁、虐待等高风险内容，riskLevel 必须为 high，并优先给出安全提示。',
  '只输出合法 JSON，不输出 Markdown。'
].join('\n')

async function optimizeMessage(userId, payload) {
  if (!Number(payload.familyId || 0)) {
    throw createError('VALIDATION_ERROR', 'AI 整理需要指定家庭', 400)
  }
  const familyContext = await buildFamilyContext(userId, payload)
  const raw = await callOpenAI(`${baseRules}
将用户给家人的原始表达优化为更清晰、温和、尊重、适合家庭沟通的话。若有接收方身份，称呼和语气要适配该家庭关系。返回字段：optimizedText, emotionTags, coreNeed, communicationAdvice, riskLevel, attackWarning。`, {
    request: sanitizeOptimizeMessagePayload(payload),
    familyContext
  })
  const result = normalizeOptimizeResult(raw)
  if (!result.optimizedText && result.riskLevel !== 'high') {
    throw createError('AI_PROVIDER_FAILED', 'AI 未返回优化文本', 502)
  }
  return result
}

async function analyzeMessage(userId, payload) {
  if (!payload.messageId) {
    throw createError('VALIDATION_ERROR', 'AI 分析需要指定留言', 400)
  }
  const messageContext = payload.messageId ? await loadMessageContext(userId, payload.messageId, payload) : null
  const raw = await callOpenAI(`${baseRules}
帮助接收方理解这段家庭留言背后的情绪和需求，不评判双方。若有发送方和接收方身份，说明可能的沟通落点，但不能替任何一方定罪。返回字段：possibleEmotions, realNeeds, whatToAvoid, suggestedResponse, riskLevel。`, {
    request: sanitizeAnalyzeMessagePayload(payload, messageContext)
  })
  return normalizeAnalyzeResult(raw)
}

async function optimizeReply(userId, payload) {
  if (!payload.messageId) {
    throw createError('VALIDATION_ERROR', 'AI 整理回复需要指定留言', 400)
  }
  const messageContext = payload.messageId ? await loadMessageContext(userId, payload.messageId, payload) : null
  const raw = await callOpenAI(`${baseRules}
将用户准备回复家人的话优化为真诚、尊重、不说教、不讽刺、较少伤害的表达。若回复对象是父母、子女、伴侣或手足，要调整称呼和边界表达。返回字段：optimizedText, emotionTags, communicationAdvice, riskLevel, attackWarning。`, {
    request: sanitizeOptimizeReplyPayload(payload, messageContext)
  })
  const result = normalizeOptimizeResult(raw)
  if (!result.optimizedText && result.riskLevel !== 'high') {
    throw createError('AI_PROVIDER_FAILED', 'AI 未返回优化回复', 502)
  }
  return result
}

module.exports = {
  optimizeMessage,
  analyzeMessage,
  optimizeReply
}
