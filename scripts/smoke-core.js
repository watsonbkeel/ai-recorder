process.env.OPENAI_API_KEY = 'smoke_fake_openai_key'

const fs = require('fs')
const http = require('http')
const path = require('path')
const axios = require('../server/node_modules/axios')
const prisma = require('../server/src/utils/prisma')
const { UPLOAD_DIR_ABS } = require('../server/src/config/env')
const app = require('../server/src/app')
const authService = require('../server/src/services/auth.service')
const familyService = require('../server/src/services/family.service')
const adminService = require('../server/src/services/admin.service')
const messageService = require('../server/src/services/message.service')
const replyService = require('../server/src/services/reply.service')
const notificationService = require('../server/src/services/notification.service')
const aiService = require('../server/src/services/ai.service')
const { buildFamilyMemoryContext } = require('../server/src/services/familyMemory.service')
const { sortFamilyMembers } = require('../server/src/utils/familyIdentity')

const aiCalls = []
const originalAxiosPost = axios.post

axios.post = async (url, body, options) => {
  const userPayload = JSON.parse(body.messages[1].content)
  aiCalls.push({
    url,
    body,
    options,
    systemPrompt: body.messages[0].content,
    userPayload
  })
  return {
    data: {
      choices: [{
        message: {
          content: JSON.stringify({
            optimizedText: '烟测 AI 整理后的表达',
            emotionTags: ['烟测'],
            coreNeed: '确认上下文权限',
            communicationAdvice: '保持温和、具体和尊重',
            riskLevel: 'low',
            attackWarning: null,
            possibleEmotions: ['愿意沟通'],
            realNeeds: ['被理解'],
            whatToAvoid: ['指责和催促'],
            suggestedResponse: '我听见你的意思了，我们慢慢说。'
          })
        }
      }]
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
  }
}

async function expectError(code, task, message) {
  try {
    await task()
  } catch (error) {
    if (error.code === code) {
      return
    }
    throw new Error(`${message}: expected ${code}, got ${error.code || error.message}`)
  }
  throw new Error(`${message}: expected ${code}, got success`)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
}

async function uploadFixture(baseUrl, token, routePath, content, mimeType, filename) {
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(content)], { type: mimeType }), filename)
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) {
    throw new Error(`upload ${routePath} failed: ${response.status} ${JSON.stringify(data)}`)
  }
  return data.data
}

async function uploadFixtureExpectError(baseUrl, token, routePath, content, mimeType, filename) {
  const form = new FormData()
  form.append('file', new Blob([content], { type: mimeType }), filename)
  const response = await fetch(`${baseUrl}${routePath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })
  const data = await response.json().catch(() => ({}))
  if (response.ok && data.success) {
    throw new Error(`upload ${routePath} should fail but succeeded`)
  }
  return data.error || {}
}

function uploadedFilePathFromUrl(url) {
  assert(url && url.startsWith('/uploads/'), 'uploaded file URL should stay under /uploads')
  const relativePath = url.replace('/uploads/', '')
  const filePath = path.resolve(UPLOAD_DIR_ABS, relativePath)
  assert(
    filePath === UPLOAD_DIR_ABS || filePath.startsWith(`${UPLOAD_DIR_ABS}${path.sep}`),
    'uploaded file path should stay under upload root'
  )
  return filePath
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return []
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  })
}

function removeEmptyUploadDirsFrom(filePath) {
  let current = path.dirname(filePath)
  while (current !== UPLOAD_DIR_ABS && current.startsWith(`${UPLOAD_DIR_ABS}${path.sep}`)) {
    try {
      fs.rmdirSync(current)
    } catch (error) {
      break
    }
    current = path.dirname(current)
  }
}

function lastAiPayload(message) {
  const call = aiCalls[aiCalls.length - 1]
  assert(call, `${message}: expected AI call`)
  return call.userPayload
}

function assertNoHiddenOriginalText(value, message) {
  const text = JSON.stringify(value)
  assert(!text.includes('必须马上'), `${message}: hidden message original text leaked`)
  assert(!text.includes('不想马上讲'), `${message}: hidden reply original text leaked`)
}

function assertFamilyMemberSort() {
  const sorted = sortFamilyMembers([
    {
      id: 3,
      role: 'member',
      relationship: 'son',
      gender: 'male',
      childOrder: 2,
      birthYear: 2014,
      joinedAt: new Date('2024-01-03T00:00:00Z')
    },
    {
      id: 2,
      role: 'member',
      relationship: 'daughter',
      gender: 'female',
      childOrder: 1,
      birthYear: 2012,
      joinedAt: new Date('2024-01-02T00:00:00Z')
    },
    {
      id: 1,
      role: 'admin',
      relationship: 'father',
      gender: 'male',
      childOrder: null,
      birthYear: 1985,
      joinedAt: new Date('2024-01-01T00:00:00Z')
    }
  ])
  assertEqual(
    sorted.map((member) => member.id).join(','),
    '1,2,3',
    'family members should sort by family role group and children by rank'
  )
}

async function pollReplyMemory(familyId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const memory = await prisma.familyMemory.findFirst({
      where: { familyId, status: 'active', sourceReplyCount: { gt: 0 } },
      orderBy: { updatedAt: 'desc' }
    })
    if (memory) {
      return memory
    }
    await delay(250)
  }
  return null
}

async function pollMessageMemory(familyId, messageId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const memory = await prisma.familyMemory.findFirst({
      where: { familyId, status: 'active', sourceMessageId: Number(messageId) },
      orderBy: { updatedAt: 'desc' }
    })
    if (memory) {
      return memory
    }
    await delay(250)
  }
  return null
}

async function pollPairMemoryForUsers(familyId, firstUserId, secondUserId, sourceReplyId) {
  const members = await prisma.familyMember.findMany({
    where: { familyId, userId: { in: [Number(firstUserId), Number(secondUserId)] } },
    select: { id: true }
  })
  assertEqual(members.length, 2, 'pair memory test users should both be active family members')
  const memberIds = members.map((member) => member.id).sort((a, b) => a - b)
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const memory = await prisma.familyMemory.findFirst({
      where: {
        familyId,
        status: 'active',
        scope: 'pair',
        memberId: memberIds[0],
        relatedMemberId: memberIds[1],
        ...(sourceReplyId ? { sourceReplyId: Number(sourceReplyId) } : {})
      },
      orderBy: { updatedAt: 'desc' }
    })
    if (memory) {
      return memory
    }
    await delay(250)
  }
  return null
}

async function main() {
  assertFamilyMemberSort()

  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const accountPrefix = `sm_${suffix}`.toLowerCase()
  const userIds = []
  let familyId = null
  let smokeServer = null
  let uploadedAudioFile = null

  try {
    const adminAuth = await authService.registerWithPassword({
      accountName: `${accountPrefix}_admin`,
      password: 'smoke-pass-1',
      nickname: '烟测爸爸'
    })
    const memberAuth = await authService.registerWithPassword({
      accountName: `${accountPrefix}_member`,
      password: 'smoke-pass-1',
      nickname: '烟测孩子'
    })
    const secondMemberAuth = await authService.registerWithPassword({
      accountName: `${accountPrefix}_second_member`,
      password: 'smoke-pass-1',
      nickname: '烟测二宝'
    })
    const lateMemberAuth = await authService.registerWithPassword({
      accountName: `${accountPrefix}_late_member`,
      password: 'smoke-pass-1',
      nickname: '烟测晚加入成员'
    })
    const rejectedAuth = await authService.registerWithPassword({
      accountName: `${accountPrefix}_rejected`,
      password: 'smoke-pass-1',
      nickname: '烟测未通过成员'
    })
    const adminId = adminAuth.user.id
    const memberId = memberAuth.user.id
    const secondMemberId = secondMemberAuth.user.id
    const lateMemberId = lateMemberAuth.user.id
    const rejectedId = rejectedAuth.user.id
    userIds.push(adminId, memberId, secondMemberId, lateMemberId, rejectedId)
    smokeServer = http.createServer(app)
    const smokeBaseUrl = await listen(smokeServer)

    const family = await familyService.createFamily(adminId, {
      name: `烟测家庭 ${suffix}`,
      relationship: 'father',
      gender: 'male',
      childOrder: 1,
      familyNickname: '爸爸',
      preferredTitle: '爸',
      identityNote: '自动化烟测账号'
    })
    familyId = family.id
    assert(family.inviteCode, 'family invite code should exist')
    assertEqual(family.role, 'admin', 'creator should be family admin')
    assertEqual(family.childOrder, null, 'non-child relationship should not keep child order')

    const foundFamily = await familyService.getFamilyByInviteCode(family.inviteCode)
    assertEqual(foundFamily.id, familyId, 'invite lookup should find family')

    const joinRequest = await familyService.createJoinRequest(memberId, familyId, {
      message: '我是来做家庭链路烟测的',
      relationship: 'daughter',
      gender: 'female',
      childOrder: 1,
      birthYear: 2012,
      familyNickname: '小宝',
      preferredTitle: '宝贝',
      identityNote: '自动化烟测成员'
    })
    assertEqual(joinRequest.status, 'pending', 'join request should be pending')

    const pendingRequests = await adminService.listJoinRequests(adminId, familyId, { status: 'pending' })
    const pendingRequest = pendingRequests.find((item) => item.id === joinRequest.id)
    assert(pendingRequest, 'admin should see pending join request')
    assertEqual(pendingRequest.relationship, 'daughter', 'join identity should be visible to admin')
    await expectError(
      'VALIDATION_ERROR',
      () => adminService.listJoinRequests(adminId, familyId, { status: 'invalid-status' }),
      'invalid join request status should return validation error'
    )
    const adminJoinNotifications = await notificationService.listNotifications(adminId, { page: 1, pageSize: 30 })
    const adminJoinNotification = adminJoinNotifications.items.find((item) => item.type === 'family_join_requested' && item.familyId === familyId)
    assert(adminJoinNotification, 'admin should receive join request notification')
    await notificationService.markRead(adminId, adminJoinNotification.id)
    const adminJoinNotificationsAfterRead = await notificationService.listNotifications(adminId, { page: 1, pageSize: 30 })
    const readAdminJoinNotification = adminJoinNotificationsAfterRead.items.find((item) => item.id === adminJoinNotification.id)
    assert(readAdminJoinNotification && readAdminJoinNotification.isRead, 'markRead should mark join request notification read')
    const adminReadAllResult = await notificationService.markAllRead(adminId)
    assert(adminReadAllResult.updatedCount >= 0, 'markAllRead should return an updated count')

    await adminService.handleJoinRequest(adminId, joinRequest.id, { action: 'approve' })
    const memberFamilies = await familyService.listMyFamilies(memberId)
    assert(memberFamilies.some((item) => item.id === familyId), 'approved member should see family')

    const rejectedJoinRequest = await familyService.createJoinRequest(rejectedId, familyId, {
      message: '这条申请用于验证拒绝通知',
      relationship: 'other',
      gender: 'unspecified',
      identityNote: '自动化烟测拒绝分支'
    })
    await adminService.handleJoinRequest(adminId, rejectedJoinRequest.id, { action: 'reject', reason: '烟测暂不通过' })
    const rejectedFamilies = await familyService.listMyFamilies(rejectedId)
    assert(!rejectedFamilies.some((item) => item.id === familyId), 'rejected applicant should not join family')
    await expectError(
      'NOT_FAMILY_MEMBER',
      () => familyService.listFamilyMembers(rejectedId, familyId),
      'rejected applicant should not gain family access'
    )
    const rejectedNotifications = await notificationService.listNotifications(rejectedId, { page: 1, pageSize: 30 })
    const rejectedNotification = rejectedNotifications.items.find((item) => item.type === 'join_request_rejected' && item.familyId === familyId)
    assert(rejectedNotification, 'rejected applicant should keep personal rejection notification without family membership')
    assert(rejectedNotification.content.includes('烟测暂不通过'), 'rejection notification should include admin reason')
    await notificationService.markAllRead(rejectedId)
    const rejectedUnreadAfterReadAll = await notificationService.getUnreadCount(rejectedId)
    assertEqual(rejectedUnreadAfterReadAll.count, 0, 'markAllRead should clear rejected applicant unread notifications')

    const secondJoinRequest = await familyService.createJoinRequest(secondMemberId, familyId, {
      message: '我是第二个孩子，用来验证子女排行',
      relationship: 'son',
      gender: 'male',
      childOrder: 2,
      birthYear: 2015,
      familyNickname: '二宝',
      preferredTitle: '弟弟',
      identityNote: '自动化烟测第二子女'
    })
    await adminService.handleJoinRequest(adminId, secondJoinRequest.id, { action: 'approve' })
    const secondMemberFamilies = await familyService.listMyFamilies(secondMemberId)
    assert(secondMemberFamilies.some((item) => item.id === familyId), 'second approved child should see family')

    const members = await familyService.listFamilyMembers(adminId, familyId)
    assertEqual(members.length, 3, 'family should have three members')
    assert(members.some((item) => item.userId === memberId && item.childOrder === 1 && item.gender === 'female'), 'member identity should be saved')
    assert(members.some((item) => item.userId === secondMemberId && item.childOrder === 2 && item.gender === 'male'), 'second child identity should be saved')
    const childMembers = members.filter((item) => ['son', 'daughter', 'child'].includes(item.relationship))
    assertEqual(childMembers[0].userId, memberId, 'oldest child should appear first across child relationship variants')
    assertEqual(childMembers[1].userId, secondMemberId, 'second child should appear second across child relationship variants')
    const adminMembers = await adminService.listMembers(adminId, familyId)
    const adminChildMembers = adminMembers.filter((item) => ['son', 'daughter', 'child'].includes(item.relationship))
    assertEqual(adminChildMembers[0].userId, memberId, 'admin member list should use child order first')
    assertEqual(adminChildMembers[1].userId, secondMemberId, 'admin member list should keep child order across gender')

    const memberUnreadBeforeSelfMessage = await notificationService.getUnreadCount(memberId)
    const selfMessage = await messageService.createMessage(adminId, familyId, {
      receiverIds: [memberId],
      visibility: 'self',
      messageType: 'general',
      originalText: '这是一条只给自己整理想法的心声。',
      optimizedText: '这是一条只给自己整理想法的心声。',
      riskLevel: 'low'
    })
    await delay(100)
    assertEqual(selfMessage.receivers.length, 0, 'self message should not create receiver records')
    await expectError(
      'FORBIDDEN',
      () => messageService.getMessageDetail(memberId, selfMessage.id),
      'self message should not be visible to other family members'
    )
    const selfReplies = await replyService.listReplies(adminId, selfMessage.id)
    assertEqual(selfReplies.length, 0, 'self message should not have replies')
    await expectError(
      'VALIDATION_ERROR',
      () => replyService.createReply(adminId, selfMessage.id, {
        originalText: '给自己的心声不应该创建回复。',
        optimizedText: '给自己的心声不应该创建回复。',
        riskLevel: 'low'
      }),
      'self message should not accept replies'
    )
    await expectError(
      'VALIDATION_ERROR',
      () => aiService.optimizeReply(adminId, {
        messageId: selfMessage.id,
        originalText: '给自己的心声不应该整理回复。',
        useFamilyMemory: false
      }),
      'self message should not accept AI reply optimization'
    )
    const memberUnreadAfterSelfMessage = await notificationService.getUnreadCount(memberId)
    assertEqual(
      memberUnreadAfterSelfMessage.count,
      memberUnreadBeforeSelfMessage.count,
      'self message should not create notifications for family members'
    )

    const familyMessage = await messageService.createMessage(adminId, familyId, {
      receiverIds: [],
      visibility: 'family',
      messageType: 'encouragement',
      originalText: '今天我们都辛苦了，晚上一起轻松聊一会儿。',
      optimizedText: '今天我们都辛苦了，晚上一起轻松聊一会儿。',
      riskLevel: 'low'
    })
    await delay(300)
    assertEqual(familyMessage.receivers.length, 2, 'family message should create receiver records for current family members')
    const familyMessageForMember = await messageService.getMessageDetail(memberId, familyMessage.id)
    assertEqual(familyMessageForMember.visibility, 'family', 'family message should be visible to family members')
    const familyMessageForSecondMember = await messageService.getMessageDetail(secondMemberId, familyMessage.id)
    assertEqual(familyMessageForSecondMember.visibility, 'family', 'family message should be visible to second family member')

    aiCalls.length = 0
    await aiService.optimizeMessage(adminId, {
      familyId,
      visibility: 'family',
      receiverIds: [],
      originalText: '我想给全家说一句今晚我们一起轻松聊聊。',
      messageType: 'encouragement',
      useFamilyMemory: false
    })
    const familyOptimizePayload = lastAiPayload('family visibility AI optimization')
    assertEqual(
      familyOptimizePayload.request.receiverIds.length,
      2,
      'AI family message optimization should resolve all current family receivers on backend'
    )
    assert(familyOptimizePayload.request.receiverIds.includes(memberId), 'AI family message optimization should include first child')
    assert(familyOptimizePayload.request.receiverIds.includes(secondMemberId), 'AI family message optimization should include second child')
    assert(!familyOptimizePayload.request.receiverIds.includes(rejectedId), 'AI family message optimization should exclude rejected applicants')
    await expectError(
      'VALIDATION_ERROR',
      () => aiService.optimizeMessage(adminId, {
        familyId,
        visibility: 'private',
        receiverIds: [],
        originalText: '这条私密留言没有选择接收人。',
        messageType: 'general',
        useFamilyMemory: false
      }),
      'AI private message optimization should require selected receivers on backend'
    )
    await expectError(
      'VALIDATION_ERROR',
      () => aiService.optimizeMessage(adminId, {
        familyId,
        visibility: 'private',
        receiverIds: [rejectedId],
        originalText: '这条私密留言选择了非家庭成员。',
        messageType: 'general',
        useFamilyMemory: false
      }),
      'AI private message optimization should reject non-family receivers on backend'
    )

    const lateJoinRequest = await familyService.createJoinRequest(lateMemberId, familyId, {
      message: '我晚一点加入，用来验证全家留言后续回复通知',
      relationship: 'child',
      gender: 'unspecified',
      childOrder: 3,
      birthYear: 2018,
      familyNickname: '晚加入的家人',
      preferredTitle: '小家人',
      identityNote: '自动化烟测晚加入成员'
    })
    await adminService.handleJoinRequest(adminId, lateJoinRequest.id, { action: 'approve' })
    const familyMessageForLateMember = await messageService.getMessageDetail(lateMemberId, familyMessage.id)
    assertEqual(familyMessageForLateMember.visibility, 'family', 'late approved member should see previous family message')

    const familyReplyForLateNotification = await replyService.createReply(secondMemberId, familyMessage.id, {
      originalText: '我也想参与今晚的轻松聊天。',
      optimizedText: '我也想参与今晚的轻松聊天，我们晚一点一起说说。',
      emotionTags: ['期待'],
      aiAdvice: '回应全家沟通邀请，并给出温和参与意愿。',
      riskLevel: 'low'
    })
    const lateNotificationsAfterFamilyReply = await notificationService.listNotifications(lateMemberId, { page: 1, pageSize: 30 })
    assert(
      lateNotificationsAfterFamilyReply.items.some((item) => item.replyId === familyReplyForLateNotification.id),
      'family message reply should notify current family members who joined after original message'
    )
    const latePairMemory = await pollPairMemoryForUsers(familyId, secondMemberId, lateMemberId, familyReplyForLateNotification.id)
    assert(
      latePairMemory,
      'family message reply should refresh pair memory for current family members who joined after original message'
    )
    aiCalls.length = 0
    await aiService.optimizeReply(lateMemberId, {
      messageId: familyMessage.id,
      originalText: '我想和大家一起聊一聊。',
      useFamilyMemory: false
    })
    const familyReplyOptimizePayload = lastAiPayload('family message reply AI optimization')
    assertEqual(
      familyReplyOptimizePayload.request.familyContext.visibility,
      'family',
      'AI reply optimization for family message should keep message visibility in backend context'
    )
    assert(
      familyReplyOptimizePayload.request.familyContext.receiverIds.includes(adminId),
      'AI family reply context should include message sender for current member'
    )
    assert(
      familyReplyOptimizePayload.request.familyContext.receiverIds.includes(memberId),
      'AI family reply context should include current family members'
    )
    assert(
      familyReplyOptimizePayload.request.familyContext.receiverIds.includes(secondMemberId),
      'AI family reply context should include family members who replied'
    )
    assert(
      !familyReplyOptimizePayload.request.familyContext.receiverIds.includes(rejectedId),
      'AI family reply context should exclude rejected applicants'
    )

    const uploadedAudio = await uploadFixture(smokeBaseUrl, adminAuth.token, '/api/upload/audio', 'smoke audio', 'audio/mpeg', 'voice.mp3')
    assert(uploadedAudio.url && uploadedAudio.url.startsWith('/uploads/audio/'), 'audio upload should return protected audio storage URL')
    assertEqual(uploadedAudio.fullUrl, undefined, 'audio upload should not return a public full URL')
    uploadedAudioFile = uploadedFilePathFromUrl(uploadedAudio.url)
    assert(fs.existsSync(uploadedAudioFile), 'uploaded audio file should exist on disk for message creation')

    const audioFilesBeforeOversize = new Set(listFiles(path.join(UPLOAD_DIR_ABS, 'audio')))
    const tooLargeAudioError = await uploadFixtureExpectError(
      smokeBaseUrl,
      adminAuth.token,
      '/api/upload/audio',
      Buffer.alloc((20 * 1024 * 1024) + 1),
      'audio/mpeg',
      'too-large.mp3'
    )
    assertEqual(tooLargeAudioError.code, 'UPLOAD_ERROR', 'oversized audio should return upload error code')
    assert(tooLargeAudioError.message.includes('20MB'), 'oversized audio should mention 20MB limit')
    assert(!tooLargeAudioError.message.includes('图片'), 'oversized audio error should not use image-only wording')
    listFiles(path.join(UPLOAD_DIR_ABS, 'audio'))
      .filter((file) => !audioFilesBeforeOversize.has(file) && file !== uploadedAudioFile)
      .forEach((file) => {
        fs.rmSync(file, { force: true })
        removeEmptyUploadDirsFrom(file)
      })

    const message = await messageService.createMessage(adminId, familyId, {
      receiverIds: [memberId],
      visibility: 'private',
      messageType: 'request',
      originalText: '你今晚必须马上把作业说清楚。',
      originalAudioUrl: uploadedAudio.url,
      audioDurationSec: 3,
      optimizedText: '宝贝，今晚我们找个合适的时间聊一下作业安排，好吗？',
      emotionTags: ['着急'],
      coreNeed: '希望了解作业安排',
      aiAdvice: '先说明关心，再约一个具体时间。',
      riskLevel: 'low',
      allowOriginalTextView: false,
      allowOriginalAudioPlay: false
    })
    await delay(300)

    const secondUnreadBeforeMisaddressedPrivateNotification = await notificationService.getUnreadCount(secondMemberId)
    const misaddressedPrivateNotification = await notificationService.createNotification({
      receiverId: secondMemberId,
      triggerUserId: adminId,
      familyId,
      type: 'message_received',
      title: '误发私密心声通知',
      content: '这条误发通知不应出现在非接收人的通知列表。',
      messageId: message.id
    })
    const secondNotificationsAfterMisaddressedPrivate = await notificationService.listNotifications(secondMemberId, { page: 1, pageSize: 50 })
    assert(
      !secondNotificationsAfterMisaddressedPrivate.items.some((item) => item.id === misaddressedPrivateNotification.id),
      'misaddressed private message notification should be filtered for non-participant family member'
    )
    const secondUnreadAfterMisaddressedPrivateNotification = await notificationService.getUnreadCount(secondMemberId)
    assertEqual(
      secondUnreadAfterMisaddressedPrivateNotification.count,
      secondUnreadBeforeMisaddressedPrivateNotification.count,
      'misaddressed private message notification should not affect visible unread count'
    )
    await notificationService.markRead(secondMemberId, misaddressedPrivateNotification.id)
    const hiddenPrivateNotificationAfterMarkRead = await prisma.notification.findUnique({
      where: { id: misaddressedPrivateNotification.id }
    })
    assertEqual(
      hiddenPrivateNotificationAfterMarkRead.isRead,
      false,
      'markRead should not mark a hidden private message notification'
    )

    const receivedMessage = await messageService.getMessageDetail(memberId, message.id)
    assertEqual(receivedMessage.originalText, null, 'hidden original text should not be returned to receiver')
    assertEqual(receivedMessage.originalAudioUrl, null, 'hidden original audio URL should not be returned to receiver')
    assertEqual(receivedMessage.audioDurationSec, null, 'hidden original audio duration should not be returned to receiver')
    assertEqual(receivedMessage.receivers.length, 1, 'private message should keep one receiver')
    await expectError(
      'FORBIDDEN',
      () => messageService.getMessageDetail(secondMemberId, message.id),
      'non-participant family member should not view private message detail'
    )
    await expectError(
      'FORBIDDEN',
      () => aiService.analyzeMessage(secondMemberId, { messageId: message.id, useFamilyMemory: true }),
      'non-participant family member should not analyze private message'
    )
    await expectError(
      'FORBIDDEN',
      () => aiService.optimizeReply(secondMemberId, {
        messageId: message.id,
        originalText: '我不在这条私密留言里，不应该能回复。',
        useFamilyMemory: true
      }),
      'non-participant family member should not optimize reply for private message'
    )
    await expectError(
      'FORBIDDEN',
      () => messageService.getOriginalAudioFile(memberId, message.id),
      'receiver without audio permission should not fetch original audio'
    )

    const senderAudioFile = await messageService.getOriginalAudioFile(adminId, message.id)
    assertEqual(senderAudioFile.filePath, uploadedAudioFile, 'sender should fetch protected original audio file')

    const memberUnread = await notificationService.getUnreadCount(memberId)
    assert(memberUnread.count >= 1, 'member should have unread message notification')

    const reply = await replyService.createReply(memberId, message.id, {
      originalText: '我现在很累，不想马上讲。',
      optimizedText: '爸，我现在有些累，想晚一点再和你聊作业安排。',
      emotionTags: ['疲惫'],
      aiAdvice: '先表达状态，再给出可沟通时间。',
      riskLevel: 'low'
    })
    const secondUnreadBeforeMisaddressedReplyNotification = await notificationService.getUnreadCount(secondMemberId)
    const misaddressedReplyNotification = await notificationService.createNotification({
      receiverId: secondMemberId,
      triggerUserId: memberId,
      familyId,
      type: 'message_replied',
      title: '误发私密回复通知',
      content: '这条误发回复通知不应出现在非接收人的通知列表。',
      messageId: message.id,
      replyId: reply.id
    })
    const secondNotificationsAfterMisaddressedReply = await notificationService.listNotifications(secondMemberId, { page: 1, pageSize: 50 })
    assert(
      !secondNotificationsAfterMisaddressedReply.items.some((item) => item.id === misaddressedReplyNotification.id),
      'misaddressed private reply notification should be filtered for non-participant family member'
    )
    const secondUnreadAfterMisaddressedReplyNotification = await notificationService.getUnreadCount(secondMemberId)
    assertEqual(
      secondUnreadAfterMisaddressedReplyNotification.count,
      secondUnreadBeforeMisaddressedReplyNotification.count,
      'misaddressed private reply notification should not affect visible unread count'
    )
    const replyMemory = await pollReplyMemory(familyId)
    assert(replyMemory, 'family memory should refresh after reply')
    assertEqual(replyMemory.scope, 'pair', 'private message memory should stay pair scoped')
    const replyMemoryText = JSON.stringify(replyMemory)
    assert(!replyMemoryText.includes('必须马上'), 'family memory should not store hidden original message text')
    assert(!replyMemoryText.includes('不想马上讲'), 'family memory should not store hidden original reply text')

    const enabledMemoryContext = await buildFamilyMemoryContext(adminId, familyId, [memberId], true)
    assert(enabledMemoryContext.enabled, 'enabled family memory context should be marked enabled')
    assert(
      enabledMemoryContext.memories.some((memory) => memory.scope === 'pair'),
      'enabled family memory context should include current pair memory'
    )
    const disabledMemoryContext = await buildFamilyMemoryContext(adminId, familyId, [memberId], false)
    assertEqual(disabledMemoryContext.enabled, false, 'disabled family memory context should be marked disabled')
    assertEqual(disabledMemoryContext.memories.length, 0, 'disabled family memory context should return no memories')

    aiCalls.length = 0
    await aiService.optimizeMessage(adminId, {
      familyId,
      visibility: 'private',
      receiverIds: [memberId],
      originalText: '我想和孩子重新约一个沟通作业的时间。',
      messageType: 'request',
      useFamilyMemory: false
    })
    const disabledOptimizeMessagePayload = lastAiPayload('disabled message AI optimization')
    assertEqual(
      disabledOptimizeMessagePayload.familyContext.familyMemory.enabled,
      false,
      'AI message optimization with disabled memory should mark family memory disabled'
    )
    assertEqual(
      disabledOptimizeMessagePayload.familyContext.familyMemory.memories.length,
      0,
      'AI message optimization with disabled memory should not include memories'
    )
    assertEqual(
      disabledOptimizeMessagePayload.request.receiverIds.includes(memberId),
      true,
      'AI message optimization should resolve selected receiver IDs on backend'
    )

    await aiService.optimizeMessage(adminId, {
      familyId,
      visibility: 'private',
      receiverIds: [memberId],
      originalText: '我想更温和地和孩子聊作业。',
      messageType: 'request',
      useFamilyMemory: true
    })
    const enabledOptimizeMessagePayload = lastAiPayload('enabled message AI optimization')
    assert(
      enabledOptimizeMessagePayload.familyContext.familyMemory.memories.some((memory) => memory.scope === 'pair'),
      'AI message optimization with enabled memory should include pair memory'
    )

    await aiService.analyzeMessage(memberId, { messageId: message.id, useFamilyMemory: false })
    const disabledAiPayload = lastAiPayload('disabled AI analysis')
    assertEqual(
      disabledAiPayload.request.familyContext.familyMemory.enabled,
      false,
      'AI analysis with disabled memory should mark family memory disabled'
    )
    assertEqual(
      disabledAiPayload.request.familyContext.familyMemory.memories.length,
      0,
      'AI analysis with disabled memory should not include memories'
    )
    assertNoHiddenOriginalText(disabledAiPayload, 'disabled AI analysis payload')

    await aiService.analyzeMessage(memberId, { messageId: message.id, useFamilyMemory: true })
    const enabledAiPayload = lastAiPayload('enabled AI analysis')
    assert(
      enabledAiPayload.request.familyContext.familyMemory.memories.some((memory) => memory.scope === 'pair'),
      'AI analysis with enabled memory should include pair memory'
    )
    assertNoHiddenOriginalText(enabledAiPayload, 'enabled AI analysis payload')

    await aiService.optimizeReply(memberId, {
      messageId: message.id,
      originalText: '我想晚一点再说。',
      useFamilyMemory: false
    })
    const replyAiPayload = lastAiPayload('reply AI optimization')
    assertEqual(
      replyAiPayload.request.familyContext.familyMemory.enabled,
      false,
      'AI reply optimization with disabled memory should mark family memory disabled'
    )
    assertEqual(
      replyAiPayload.request.familyContext.familyMemory.memories.length,
      0,
      'AI reply optimization with disabled memory should not include memories'
    )
    assertNoHiddenOriginalText(replyAiPayload, 'reply AI optimization payload')

    const repliesForAdmin = await replyService.listReplies(adminId, message.id)
    const replyForAdmin = repliesForAdmin.find((item) => item.id === reply.id)
    assert(replyForAdmin, 'message sender should see reply')
    assertEqual(replyForAdmin.originalText, null, 'reply original text should be hidden from non-sender')

    const adminUnread = await notificationService.getUnreadCount(adminId)
    assert(adminUnread.count >= 1, 'admin should have unread reply notification')

    const detailBeforeDeletedReply = await messageService.getMessageDetail(adminId, message.id)
    assertEqual(detailBeforeDeletedReply.replyCount, 1, 'message should count visible reply before reply deletion')
    await replyService.deleteReply(memberId, reply.id)
    const detailAfterDeletedReply = await messageService.getMessageDetail(adminId, message.id)
    assertEqual(detailAfterDeletedReply.replyCount, 0, 'deleting a reply should decrement message reply count')
    const deletedReplyMemoryCount = await prisma.familyMemory.count({ where: { familyId, status: 'stale' } })
    assert(deletedReplyMemoryCount >= 1, 'deleting a reply should mark related family memories stale')
    const adminNotificationsAfterDeletedReply = await notificationService.listNotifications(adminId, { page: 1, pageSize: 30 })
    assert(
      !adminNotificationsAfterDeletedReply.items.some((item) => item.replyId === reply.id),
      'deleted reply notification should be filtered'
    )

    const replyForHide = await replyService.createReply(memberId, message.id, {
      originalText: '我想先休息一下，晚饭后再说。',
      optimizedText: '爸，我想先休息一下，晚饭后再和你聊作业安排。',
      emotionTags: ['疲惫'],
      aiAdvice: '先表达状态，再给出明确时间。',
      riskLevel: 'low'
    })
    const activeMemoryBeforeHideReply = await pollReplyMemory(familyId)
    assert(activeMemoryBeforeHideReply && activeMemoryBeforeHideReply.status === 'active', 'reply memory should refresh before hide reply test')
    const detailBeforeHiddenReply = await messageService.getMessageDetail(adminId, message.id)
    assertEqual(detailBeforeHiddenReply.replyCount, 1, 'message should count visible reply before admin hide')
    await adminService.hideReply(adminId, replyForHide.id, { reason: '烟测隐藏回复' })
    const detailAfterHiddenReply = await messageService.getMessageDetail(adminId, message.id)
    assertEqual(detailAfterHiddenReply.replyCount, 0, 'hiding a reply should decrement message reply count')
    const memoryAfterHiddenReply = await prisma.familyMemory.findUnique({ where: { id: activeMemoryBeforeHideReply.id } })
    assertEqual(memoryAfterHiddenReply.status, 'stale', 'hiding a reply should mark active family memory stale')
    const adminNotificationsAfterHiddenReply = await notificationService.listNotifications(adminId, { page: 1, pageSize: 30 })
    assert(
      !adminNotificationsAfterHiddenReply.items.some((item) => item.replyId === replyForHide.id),
      'hidden reply notification should be filtered'
    )

    await expectError(
      'NOT_FAMILY_ADMIN',
      () => adminService.getDashboard(memberId, familyId),
      'non-admin member should not access admin dashboard'
    )
    await expectError(
      'FORBIDDEN',
      () => adminService.updateMuteStatus(adminId, familyId, adminId, { isMuted: true }),
      'admin should not mute self'
    )
    await expectError(
      'FORBIDDEN',
      () => adminService.updateMemberRole(adminId, familyId, adminId, { role: 'member' }),
      'last admin should not be demoted'
    )
    await expectError(
      'FORBIDDEN',
      () => adminService.removeMember(adminId, familyId, adminId, { reason: '烟测自我移除' }),
      'admin should not remove self'
    )

    await adminService.updateMuteStatus(adminId, familyId, memberId, { isMuted: true })
    await expectError(
      'USER_MUTED',
      () => messageService.createMessage(memberId, familyId, {
        receiverIds: [adminId],
        visibility: 'private',
        messageType: 'general',
        originalText: '停用成员尝试留言',
        optimizedText: '停用成员尝试留言',
        riskLevel: 'low'
      }),
      'muted member should not create messages'
    )
    await expectError(
      'USER_MUTED',
      () => replyService.createReply(memberId, message.id, {
        originalText: '停用成员尝试回复',
        optimizedText: '停用成员尝试回复',
        riskLevel: 'low'
      }),
      'muted member should not create replies'
    )
    await adminService.updateMuteStatus(adminId, familyId, memberId, { isMuted: false })

    const messageForDelete = await messageService.createMessage(adminId, familyId, {
      receiverIds: [memberId],
      visibility: 'private',
      messageType: 'explain',
      originalText: '这条留言用于验证删除后的通知和记忆处理。',
      optimizedText: '这条留言用于验证删除后的通知和记忆处理。',
      emotionTags: ['平静'],
      coreNeed: '确认删除后的边界',
      aiAdvice: '删除后不再展示相关入口。',
      riskLevel: 'low'
    })
    const deleteMessageMemory = await pollMessageMemory(familyId, messageForDelete.id)
    assert(deleteMessageMemory, 'message memory should refresh before delete message test')
    const memberNotificationsBeforeMessageDelete = await notificationService.listNotifications(memberId, { page: 1, pageSize: 30 })
    assert(
      memberNotificationsBeforeMessageDelete.items.some((item) => item.messageId === messageForDelete.id),
      'message notification should exist before message deletion'
    )
    await messageService.deleteMessage(adminId, messageForDelete.id)
    const memoryAfterDeletedMessage = await prisma.familyMemory.findUnique({ where: { id: deleteMessageMemory.id } })
    assertEqual(memoryAfterDeletedMessage.status, 'stale', 'deleting a message should mark active family memory stale')
    await expectError(
      'CONTENT_NOT_VISIBLE',
      () => messageService.getMessageDetail(memberId, messageForDelete.id),
      'deleted message should not be visible'
    )
    const memberNotificationsAfterMessageDelete = await notificationService.listNotifications(memberId, { page: 1, pageSize: 30 })
    assert(
      !memberNotificationsAfterMessageDelete.items.some((item) => item.messageId === messageForDelete.id),
      'deleted message notification should be filtered'
    )

    await adminService.hideMessage(adminId, message.id, { reason: '烟测隐藏留言' })
    const staleMemoryCount = await prisma.familyMemory.count({ where: { familyId, status: 'stale' } })
    assert(staleMemoryCount >= 1, 'hiding message should mark related family memories stale')
    await expectError(
      'CONTENT_NOT_VISIBLE',
      () => messageService.getMessageDetail(memberId, message.id),
      'hidden message should not be visible'
    )

    const visibleNotifications = await notificationService.listNotifications(memberId, { page: 1, pageSize: 30 })
    assert(
      !visibleNotifications.items.some((item) => item.messageId === message.id),
      'hidden message notification should be filtered'
    )

    await adminService.removeMember(adminId, familyId, memberId, { reason: '烟测移除成员' })
    await expectError(
      'NOT_FAMILY_MEMBER',
      () => familyService.listFamilyMembers(memberId, familyId),
      'removed member should lose family access'
    )

    const afterRemoveNotifications = await notificationService.listNotifications(memberId, { page: 1, pageSize: 30 })
    assert(
      afterRemoveNotifications.items.every((item) => !item.familyId || ['join_request_approved', 'join_request_rejected'].includes(item.type)),
      'removed member should not see family-scoped content notifications'
    )

    process.stdout.write('Core smoke test passed.\n')
  } finally {
    axios.post = originalAxiosPost
    if (familyId) {
      await prisma.family.deleteMany({ where: { id: familyId } })
    }
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
    if (uploadedAudioFile) {
      fs.rmSync(uploadedAudioFile, { force: true })
      removeEmptyUploadDirsFrom(uploadedAudioFile)
    }
    if (smokeServer) {
      await new Promise((resolve) => smokeServer.close(resolve))
    }
    await prisma.$disconnect()
  }
}

main().catch(async (error) => {
  await prisma.$disconnect()
  process.stderr.write(`Core smoke test failed: ${error.message}\n`)
  process.exit(1)
})
