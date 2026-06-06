const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { generateInviteCode } = require('../utils/inviteCode')
const { ensureFamilyMember } = require('../middleware/auth')
const {
  normalizeIdentityPayload,
  normalizeIdentityUpdatePayload,
  mapIdentity,
  mapMember,
  sortFamilyMembers
} = require('../utils/familyIdentity')
const { createNotification } = require('./notification.service')

async function createUniqueInviteCode(tx) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = generateInviteCode()
    const exists = await tx.family.findUnique({ where: { inviteCode } })
    if (!exists) {
      return inviteCode
    }
  }
  throw createError('INTERNAL_ERROR', '生成邀请码失败', 500)
}

function mapFamily(family, member) {
  const identity = member ? mapIdentity(member) : {}
  return {
    id: family.id,
    name: family.name,
    description: family.description,
    inviteCode: family.inviteCode,
    memberCount: family._count ? family._count.members : undefined,
    messageCount: family._count ? family._count.messages : undefined,
    role: member ? member.role : null,
    isMuted: member ? member.isMuted : false,
    joinedAt: member ? member.joinedAt : null,
    ...identity
  }
}

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

async function createFamily(userId, payload) {
  const name = String(payload.name || '').trim()
  const description = String(payload.description || '').trim()
  const identity = normalizeIdentityPayload(payload)

  if (!name) {
    throw createError('VALIDATION_ERROR', '家庭名称不能为空', 400)
  }

  return prisma.$transaction(async (tx) => {
    const inviteCode = await createUniqueInviteCode(tx)
    const family = await tx.family.create({
      data: {
        name,
        description: description || null,
        inviteCode,
        createdById: Number(userId)
      }
    })

    const member = await tx.familyMember.create({
      data: {
        familyId: family.id,
        userId: Number(userId),
        role: 'admin',
        ...identity
      }
    })

    return mapFamily(family, member)
  })
}

async function listMyFamilies(userId) {
  const memberships = await prisma.familyMember.findMany({
    where: { userId: Number(userId) },
    orderBy: { joinedAt: 'desc' },
    include: {
      family: {
        include: {
          _count: { select: { members: true, messages: true } }
        }
      }
    }
  })

  return memberships.map((membership) => mapFamily(membership.family, membership))
}

async function getFamilyByInviteCode(inviteCode) {
  const code = String(inviteCode || '').trim().toUpperCase()
  if (!code) {
    throw createError('VALIDATION_ERROR', '邀请码不能为空', 400)
  }

  const family = await prisma.family.findUnique({
    where: { inviteCode: code },
    include: { _count: { select: { members: true, messages: true } } }
  })
  if (!family) {
    throw createError('NOT_FOUND', '未找到家庭', 404)
  }

  return mapFamily(family, null)
}

async function listFamilyMembers(userId, familyId) {
  await ensureFamilyMember(userId, familyId)
  const members = await prisma.familyMember.findMany({
    where: { familyId: Number(familyId) },
    orderBy: [{ joinedAt: 'asc' }],
    include: memberInclude()
  })
  return sortFamilyMembers(members).map((member) => mapMember(member, userId))
}

async function updateMyIdentity(userId, familyId, payload) {
  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: Number(familyId), userId: Number(userId) } },
    include: {
      family: { include: { _count: { select: { members: true, messages: true } } } }
    }
  })
  if (!member) {
    throw createError('FORBIDDEN', '未加入该家庭', 403)
  }

  const identity = normalizeIdentityUpdatePayload(payload, member)
  const updated = await prisma.familyMember.update({
    where: { id: member.id },
    data: identity
  })
  return mapFamily(member.family, updated)
}

async function updateFamilyNickname(userId, familyId, payload) {
  return updateMyIdentity(userId, familyId, { familyNickname: payload.familyNickname })
}

async function updateRelationship(userId, familyId, payload) {
  return updateMyIdentity(userId, familyId, {
    relationship: payload.relationship
  })
}

async function createJoinRequest(userId, familyId, payload) {
  const numericFamilyId = Number(familyId)
  const message = String(payload.message || '').trim()
  const identity = normalizeIdentityPayload(payload)
  const family = await prisma.family.findUnique({
    where: { id: numericFamilyId },
    include: { members: { where: { role: 'admin' }, select: { userId: true } } }
  })
  if (!family) {
    throw createError('NOT_FOUND', '家庭不存在', 404)
  }

  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: numericFamilyId, userId: Number(userId) } }
  })
  if (member) {
    throw createError('ALREADY_EXISTS', '你已加入该家庭', 400)
  }

  const pendingRequest = await prisma.familyJoinRequest.findFirst({
    where: { familyId: numericFamilyId, userId: Number(userId), status: 'pending' }
  })
  if (pendingRequest) {
    throw createError('ALREADY_EXISTS', '你已提交申请，请等待审核', 400)
  }

  return prisma.$transaction(async (tx) => {
    const joinRequest = await tx.familyJoinRequest.create({
      data: {
        familyId: numericFamilyId,
        userId: Number(userId),
        message: message || null,
        ...identity
      }
    })

    for (const admin of family.members) {
      await createNotification({
        receiverId: admin.userId,
        triggerUserId: Number(userId),
        familyId: numericFamilyId,
        type: 'family_join_requested',
        title: '有新的家人申请加入',
        content: message || '请在家庭管理中确认申请人的身份。'
      }, tx)
    }

    return {
      id: joinRequest.id,
      familyId: joinRequest.familyId,
      status: joinRequest.status,
      message: joinRequest.message,
      ...mapIdentity(joinRequest)
    }
  })
}

module.exports = {
  createFamily,
  listMyFamilies,
  getFamilyByInviteCode,
  listFamilyMembers,
  updateMyIdentity,
  updateFamilyNickname,
  updateRelationship,
  createJoinRequest
}
