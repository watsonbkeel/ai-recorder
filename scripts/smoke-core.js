const prisma = require('../server/src/utils/prisma')
const authService = require('../server/src/services/auth.service')
const familyService = require('../server/src/services/family.service')
const adminService = require('../server/src/services/admin.service')
const messageService = require('../server/src/services/message.service')
const replyService = require('../server/src/services/reply.service')
const notificationService = require('../server/src/services/notification.service')

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

async function main() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const accountPrefix = `smoke_${suffix}`.toLowerCase()
  const userIds = []
  let familyId = null

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
    const adminId = adminAuth.user.id
    const memberId = memberAuth.user.id
    userIds.push(adminId, memberId)

    const family = await familyService.createFamily(adminId, {
      name: `烟测家庭 ${suffix}`,
      relationship: 'father',
      gender: 'male',
      familyNickname: '爸爸',
      preferredTitle: '爸',
      identityNote: '自动化烟测账号'
    })
    familyId = family.id
    assert(family.inviteCode, 'family invite code should exist')
    assertEqual(family.role, 'admin', 'creator should be family admin')

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

    await adminService.handleJoinRequest(adminId, joinRequest.id, { action: 'approve' })
    const memberFamilies = await familyService.listMyFamilies(memberId)
    assert(memberFamilies.some((item) => item.id === familyId), 'approved member should see family')

    const members = await familyService.listFamilyMembers(adminId, familyId)
    assertEqual(members.length, 2, 'family should have two members')
    assert(members.some((item) => item.userId === memberId && item.childOrder === 1 && item.gender === 'female'), 'member identity should be saved')

    const message = await messageService.createMessage(adminId, familyId, {
      receiverIds: [memberId],
      visibility: 'private',
      messageType: 'request',
      originalText: '你今晚必须马上把作业说清楚。',
      optimizedText: '宝贝，今晚我们找个合适的时间聊一下作业安排，好吗？',
      emotionTags: ['着急'],
      coreNeed: '希望了解作业安排',
      aiAdvice: '先说明关心，再约一个具体时间。',
      riskLevel: 'low',
      allowOriginalTextView: false,
      allowOriginalAudioPlay: false
    })
    await delay(300)

    const receivedMessage = await messageService.getMessageDetail(memberId, message.id)
    assertEqual(receivedMessage.originalText, null, 'hidden original text should not be returned to receiver')
    assertEqual(receivedMessage.receivers.length, 1, 'private message should keep one receiver')

    const memberUnread = await notificationService.getUnreadCount(memberId)
    assert(memberUnread.count >= 1, 'member should have unread message notification')

    const reply = await replyService.createReply(memberId, message.id, {
      originalText: '我现在很累，不想马上讲。',
      optimizedText: '爸，我现在有些累，想晚一点再和你聊作业安排。',
      emotionTags: ['疲惫'],
      aiAdvice: '先表达状态，再给出可沟通时间。',
      riskLevel: 'low'
    })
    const replyMemory = await pollReplyMemory(familyId)
    assert(replyMemory, 'family memory should refresh after reply')
    assertEqual(replyMemory.scope, 'pair', 'private message memory should stay pair scoped')

    const repliesForAdmin = await replyService.listReplies(adminId, message.id)
    const replyForAdmin = repliesForAdmin.find((item) => item.id === reply.id)
    assert(replyForAdmin, 'message sender should see reply')
    assertEqual(replyForAdmin.originalText, null, 'reply original text should be hidden from non-sender')

    const adminUnread = await notificationService.getUnreadCount(adminId)
    assert(adminUnread.count >= 1, 'admin should have unread reply notification')

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
    if (familyId) {
      await prisma.family.deleteMany({ where: { id: familyId } })
    }
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
    await prisma.$disconnect()
  }
}

main().catch(async (error) => {
  await prisma.$disconnect()
  process.stderr.write(`Core smoke test failed: ${error.message}\n`)
  process.exit(1)
})
