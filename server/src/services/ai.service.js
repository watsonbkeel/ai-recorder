const axios = require('axios')
const { createError } = require('../utils/errors')
const { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_TIMEOUT_MS } = require('../config/env')

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

const baseRules = [
  '你是家庭沟通表达助手，只做表达翻译和理解辅助，不裁判谁对谁错。',
  '必须保留用户真实意思，不编造事实、承诺、道歉、爱意或责任。',
  '不要鼓励忍耐伤害、家暴、羞辱、控制或情绪勒索。',
  '如果存在自伤、家暴、威胁、虐待等高风险内容，riskLevel 必须为 high，并优先给出安全提示。',
  '只输出合法 JSON，不输出 Markdown。'
].join('\n')

async function optimizeMessage(payload) {
  const raw = await callOpenAI(`${baseRules}
将用户给家人的原始表达优化为更清晰、温和、尊重、适合家庭沟通的话。返回字段：optimizedText, emotionTags, coreNeed, communicationAdvice, riskLevel, attackWarning。`, payload)
  const result = normalizeOptimizeResult(raw)
  if (!result.optimizedText && result.riskLevel !== 'high') {
    throw createError('AI_PROVIDER_FAILED', 'AI 未返回优化文本', 502)
  }
  return result
}

async function analyzeMessage(payload) {
  const raw = await callOpenAI(`${baseRules}
帮助接收方理解这段家庭留言背后的情绪和需求，不评判双方。返回字段：possibleEmotions, realNeeds, whatToAvoid, suggestedResponse, riskLevel。`, payload)
  return normalizeAnalyzeResult(raw)
}

async function optimizeReply(payload) {
  const raw = await callOpenAI(`${baseRules}
将用户准备回复家人的话优化为真诚、尊重、不说教、不讽刺、较少伤害的表达。返回字段：optimizedText, emotionTags, communicationAdvice, riskLevel, attackWarning。`, payload)
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
