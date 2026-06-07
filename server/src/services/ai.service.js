const path = require('path')
const { openAsBlob } = require('fs')
const axios = require('axios')
const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { ensureFamilyMember } = require('../middleware/auth')
const { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_TRANSCRIBE_MODEL, OPENAI_TIMEOUT_MS } = require('../config/env')
const { familyUserSelect, mapFamilyUser, mapMember } = require('../utils/familyIdentity')
const { DEFAULT_FAMILY_SLOTS, normalizeSlotKeys, slotLabel } = require('../utils/familySlots')
const { canViewMessage, messageVisibleToUserWhere } = require('../utils/messageAccess')
const { resolveAudioUploadPath, assertUploadedFileExists } = require('../utils/uploadPaths')
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

const VALID_VISIBILITIES = new Set(['private', 'family', 'self'])

function normalizeVisibility(value) {
  return VALID_VISIBILITIES.has(value) ? value : 'private'
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

function shouldRetryWithoutResponseFormat(error) {
  const status = error.response ? error.response.status : 0
  if (status !== 400 && status !== 422) {
    return false
  }
  const data = error.response && error.response.data ? JSON.stringify(error.response.data) : ''
  return /response_format|json_object|unsupported|not support|invalid/i.test(data)
}

async function requestChatCompletion(systemPrompt, userPayload, useJsonResponseFormat) {
  assertConfigured()
  const baseUrl = OPENAI_BASE_URL.replace(/\/$/, '')
  const response = await axios.post(`${baseUrl}/chat/completions`, {
    model: OPENAI_MODEL,
    temperature: 0.2,
    ...(useJsonResponseFormat ? { response_format: { type: 'json_object' } } : {}),
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
  })
  return response
}

async function callOpenAI(systemPrompt, userPayload) {
  let response
  try {
    response = await requestChatCompletion(systemPrompt, userPayload, true)
  } catch (error) {
    if (!shouldRetryWithoutResponseFormat(error)) {
      const status = error.response ? error.response.status : 502
      throw createError('AI_PROVIDER_FAILED', `AI 服务调用失败: ${status}`, 502)
    }
    try {
      response = await requestChatCompletion(systemPrompt, userPayload, false)
    } catch (retryError) {
      const status = retryError.response ? retryError.response.status : 502
      throw createError('AI_PROVIDER_FAILED', `AI 服务调用失败: ${status}`, 502)
    }
  }

  const content = response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message
    ? response.data.choices[0].message.content
    : ''
  return extractJson(content)
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

function sanitizeOptimizeMessagePayload(payload = {}, familyContext = null) {
  const contextReceiverIds = familyContext && Array.isArray(familyContext.receiverIds)
    ? familyContext.receiverIds
    : []
  const contextReceiverSlotKeys = familyContext && Array.isArray(familyContext.receiverSlotKeys)
    ? familyContext.receiverSlotKeys
    : []
  return {
    originalText: normalizeOriginalText(payload.originalText),
    hasOriginalAudio: Boolean(payload.hasOriginalAudio),
    messageType: payload.messageType || 'general',
    familyId: Number(payload.familyId || 0) || null,
    visibility: familyContext ? familyContext.visibility : normalizeVisibility(payload.visibility),
    receiverIds: contextReceiverIds,
    receiverSlotKeys: contextReceiverSlotKeys,
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

function mapReceiverSlot(slotKey, member, currentUserId) {
  const slot = DEFAULT_FAMILY_SLOTS.find((item) => item.key === slotKey)
  return {
    slotKey,
    label: slotLabel(slotKey, member ? member.relationship : undefined),
    baseLabel: slot ? slot.label : '家人',
    group: slot ? slot.group : 'other',
    childOrder: slot ? slot.childOrder : null,
    occupied: Boolean(member),
    member: member ? mapMember(member, currentUserId) : null
  }
}

async function loadFamilyMembers(familyId, currentUserId, receiverIds = [], receiverSlotKeys = []) {
  const ids = Array.from(new Set([Number(currentUserId), ...receiverIds]))
  const members = await prisma.familyMember.findMany({
    where: {
      familyId: Number(familyId),
      OR: [
        { userId: { in: ids } },
        ...(receiverSlotKeys.length ? [{ slotKey: { in: receiverSlotKeys } }] : [])
      ]
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true, isGlobalAdmin: true }
      }
    }
  })
  const mapped = members.map((member) => mapMember(member, currentUserId))
  const memberBySlot = new Map()
  members.forEach((member) => {
    if (member.slotKey) {
      memberBySlot.set(member.slotKey, member)
    }
  })
  const receiverUserIdSet = new Set(receiverIds.map(Number))
  return {
    current: mapped.find((member) => Number(member.userId) === Number(currentUserId)) || null,
    receivers: mapped.filter((member) => receiverUserIdSet.has(Number(member.userId))),
    receiverSlots: receiverSlotKeys.map((slotKey) => mapReceiverSlot(slotKey, memberBySlot.get(slotKey), currentUserId))
  }
}

async function resolveContextReceiverIds(userId, familyId, payload = {}, options = {}) {
  const visibility = normalizeVisibility(payload.visibility || options.visibility)
  const currentMember = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: Number(familyId), userId: Number(userId) } },
    select: { slotKey: true }
  })
  if (visibility === 'self') {
    return { visibility, receiverIds: [], receiverSlotKeys: [] }
  }

  if (visibility === 'family') {
    const members = await prisma.familyMember.findMany({
      where: {
        familyId: Number(familyId),
        userId: { not: Number(userId) }
      },
      select: { userId: true }
    })
    return {
      visibility,
      receiverIds: members.map((member) => member.userId),
      receiverSlotKeys: []
    }
  }

  const requestedReceiverIds = normalizeReceiverIds(payload.receiverIds || options.receiverIds || [], userId)
  const requestedSlotKeys = normalizeSlotKeys(payload.receiverSlotKeys || payload.slotKeys || options.receiverSlotKeys || [])
    .filter((slotKey) => slotKey !== (currentMember && currentMember.slotKey))

  if (!requestedReceiverIds.length && !requestedSlotKeys.length) {
    if (!options.allowEmptyPrivateReceivers) {
      throw createError('VALIDATION_ERROR', '请选择接收家人', 400)
    }
    return { visibility, receiverIds: [], receiverSlotKeys: [] }
  }

  const members = await prisma.familyMember.findMany({
    where: {
      familyId: Number(familyId),
      userId: { in: requestedReceiverIds }
    },
    select: { userId: true }
  })
  if (members.length !== requestedReceiverIds.length && !options.allowMissingPrivateReceivers) {
    throw createError('VALIDATION_ERROR', '接收人必须是家庭成员', 400)
  }
  const slotMembers = requestedSlotKeys.length
    ? await prisma.familyMember.findMany({
        where: {
          familyId: Number(familyId),
          slotKey: { in: requestedSlotKeys },
          userId: { not: Number(userId) }
        },
        select: { userId: true }
      })
    : []
  return {
    visibility,
    receiverIds: Array.from(new Set([
      ...members.map((member) => member.userId),
      ...slotMembers.map((member) => member.userId)
    ])),
    receiverSlotKeys: requestedSlotKeys
  }
}

async function loadVisibleHistory(userId, familyId, excludeMessageId, memberships) {
  const viewerMemberships = memberships || await prisma.familyMember.findMany({
    where: { userId: Number(userId) },
    select: { familyId: true, slotKey: true }
  })
  const where = {
    familyId: Number(familyId),
    status: 'visible',
    ...(excludeMessageId ? { id: { not: Number(excludeMessageId) } } : {}),
    ...messageVisibleToUserWhere(userId, viewerMemberships.filter((member) => Number(member.familyId) === Number(familyId)))
  }

  const messages = await prisma.familyMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: {
      sender: { select: familyUserSelect(familyId) },
      receivers: { include: { user: { select: familyUserSelect(familyId) } } },
      slotReceivers: true,
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
    receiverSlots: (message.slotReceivers || []).map((receiver) => ({
      slotKey: receiver.slotKey,
      label: slotLabel(receiver.slotKey)
    })),
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

  const currentMembership = await ensureFamilyMember(userId, familyId)
  const { visibility, receiverIds, receiverSlotKeys } = await resolveContextReceiverIds(userId, familyId, payload, options)
  const useFamilyMemory = payload.useFamilyMemory !== false && options.useFamilyMemory !== false
  const [family, members, history, memoryContext] = await Promise.all([
    prisma.family.findUnique({ where: { id: familyId }, select: { id: true, name: true, description: true } }),
    loadFamilyMembers(familyId, userId, receiverIds, receiverSlotKeys),
    loadVisibleHistory(userId, familyId, options.excludeMessageId, [currentMembership]),
    buildFamilyMemoryContext(userId, familyId, receiverIds, useFamilyMemory)
  ])

  return {
    family,
    visibility,
    receiverIds,
    receiverSlotKeys,
    currentMember: members.current,
    receivers: members.receivers,
    receiverSlots: members.receiverSlots,
    visibleRecentMessages: history,
    familyMemory: memoryContext
  }
}

async function loadMessageContext(userId, messageId, payload = {}, options = {}) {
  const message = await prisma.familyMessage.findUnique({
    where: { id: Number(messageId) },
    include: {
      receivers: true
      ,
      slotReceivers: true
    }
  })
  if (!message || message.status !== 'visible') {
    throw createError('CONTENT_NOT_VISIBLE', '心声不可见', 404)
  }
  const viewerMember = await ensureFamilyMember(userId, message.familyId)
  if (!canViewMessage(message, userId, viewerMember)) {
    throw createError('FORBIDDEN', '无权使用这条心声作为 AI 上下文', 403)
  }
  if (options.rejectSelfReply && message.visibility === 'self') {
    throw createError('VALIDATION_ERROR', '仅自己留言不需要回复', 400)
  }
  const contextReceiverIds = Array.from(new Set([
    message.senderId,
    ...message.receivers
      .map((receiver) => receiver.userId)
      .filter((receiverUserId) => Number(receiverUserId) === Number(userId) || Number(message.senderId) === Number(userId))
  ])).filter((receiverUserId) => Number(receiverUserId) !== Number(userId))
  const contextReceiverSlotKeys = message.senderId === Number(userId)
    ? message.slotReceivers.map((receiver) => receiver.slotKey)
    : []

  const familyContext = await buildFamilyContext(userId, {
    familyId: message.familyId,
    visibility: message.visibility,
    receiverIds: contextReceiverIds,
    receiverSlotKeys: contextReceiverSlotKeys,
    useFamilyMemory: payloadUseFamilyMemory(payload)
  }, { excludeMessageId: message.id, useFamilyMemory: payloadUseFamilyMemory(payload) })

  return {
    familyContext,
    message: {
      id: message.id,
      familyId: message.familyId,
      visibility: message.visibility,
      messageType: message.messageType,
      optimizedText: message.optimizedText,
      coreNeed: message.coreNeed || '',
      riskLevel: message.riskLevel,
      senderId: message.senderId,
      receiverIds: message.receivers.map((receiver) => receiver.userId),
      receiverSlotKeys: message.slotReceivers.map((receiver) => receiver.slotKey)
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
  if (!normalizeOriginalText(payload.originalText)) {
    throw createError('VALIDATION_ERROR', 'AI 整理需要先提供文字原话或语音大意', 400)
  }
  const familyContext = await buildFamilyContext(userId, payload)
  const raw = await callOpenAI(`${baseRules}
将用户给家人的原始表达优化为更清晰、温和、尊重、适合家庭沟通的话。若有接收方身份，称呼和语气要适配该家庭关系。返回字段：optimizedText, emotionTags, coreNeed, communicationAdvice, riskLevel, attackWarning。`, {
    request: sanitizeOptimizeMessagePayload(payload, familyContext),
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
  const messageContext = payload.messageId ? await loadMessageContext(userId, payload.messageId, payload, { rejectSelfReply: true }) : null
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

async function transcribeAudio(userId, payload) {
  assertConfigured()
  const familyId = Number(payload.familyId || 0)
  if (familyId) {
    await ensureFamilyMember(userId, familyId)
  }
  const audioUrl = String(payload.audioUrl || payload.originalAudioUrl || '').trim()
  if (!audioUrl) {
    throw createError('VALIDATION_ERROR', '请先上传录音，再进行语音转文字', 400)
  }
  const filePath = resolveAudioUploadPath(audioUrl)
  assertUploadedFileExists(filePath, '录音文件不存在，请重新录制后再试')

  const baseUrl = OPENAI_BASE_URL.replace(/\/$/, '')
  const formData = new FormData()
  const blob = await openAsBlob(filePath)
  formData.append('file', blob, path.basename(filePath))
  formData.append('model', OPENAI_TRANSCRIBE_MODEL)
  formData.append('response_format', 'json')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)
  let response
  try {
    response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: formData,
      signal: controller.signal
    })
  } catch (error) {
    const message = error.name === 'AbortError'
      ? '语音转文字服务超时，请稍后重试，或先手动输入文字'
      : '语音转文字服务暂时不可用，请先手动输入文字'
    throw createError('AI_TRANSCRIBE_FAILED', message, 502)
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw createError('AI_TRANSCRIBE_FAILED', `语音转文字服务调用失败: ${response.status}，请先手动输入文字`, 502)
  }

  let data
  try {
    data = await response.json()
  } catch (error) {
    throw createError('AI_TRANSCRIBE_FAILED', '语音转文字服务返回异常，请先手动输入文字', 502)
  }

  const text = String(data.text || data.transcript || data.result || '').trim()
  if (!text) {
    throw createError('AI_TRANSCRIBE_FAILED', '语音转文字未识别到清晰文字，请先手动输入文字', 502)
  }

  return { text }
}

module.exports = {
  optimizeMessage,
  analyzeMessage,
  optimizeReply,
  transcribeAudio
}
