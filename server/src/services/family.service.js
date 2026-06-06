const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { generateInviteCode } = require('../utils/inviteCode')

const VALID_RELATIONSHIPS = new Set(['father', 'mother', 'son', 'daughter', 'grandparent', 'partner', 'sibling', 'other'])

function normalizeRelationship(value) {
  return VALID_RELATIONSHIPS.has(value) ? value : 'other'
}

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
  return {
    id: family.id,
    name: family.name,
    description: family.description,
    inviteCode: family.inviteCode,
    memberCount: family._count ? family._count.members : undefined,
    messageCount: family._count ? family._count.messages : undefined,
    role: member ? member.role : null,
    familyNickname: member ? member.familyNickname : null,
    relationship: member ? member.relationship : null,
    isMuted: member ? member.isMuted : false,
    joinedAt: member ? member.joinedAt : null
  }
}

async function createFamily(userId, payload) {
  const name = String(payload.name || '').trim()
  const description = String(payload.description || '').trim()
  const relationship = normalizeRelationship(payload.relationship)
  const familyNickname = String(payload.familyNickname || payload.nickname || '').trim()

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
        relationship,
        familyNickname: familyNickname || null
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

async function updateFamilyNickname(userId, familyId, payload) {
  const familyNickname = String(payload.familyNickname || '').trim()
  if (!familyNickname) {
    throw createError('VALIDATION_ERROR', '家庭昵称不能为空', 400)
  }

  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: Number(familyId), userId: Number(userId) } },
    include: { family: { include: { _count: { select: { members: true, messages: true } } } } }
  })
  if (!member) {
    throw createError('FORBIDDEN', '未加入该家庭', 403)
  }

  const updated = await prisma.familyMember.update({
    where: { id: member.id },
    data: { familyNickname }
  })
  return mapFamily(member.family, updated)
}

async function updateRelationship(userId, familyId, payload) {
  const relationship = normalizeRelationship(payload.relationship)
  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: Number(familyId), userId: Number(userId) } },
    include: { family: { include: { _count: { select: { members: true, messages: true } } } } }
  })
  if (!member) {
    throw createError('FORBIDDEN', '未加入该家庭', 403)
  }

  const updated = await prisma.familyMember.update({
    where: { id: member.id },
    data: { relationship }
  })
  return mapFamily(member.family, updated)
}

async function createJoinRequest(userId, familyId, payload) {
  const numericFamilyId = Number(familyId)
  const message = String(payload.message || '').trim()
  const family = await prisma.family.findUnique({ where: { id: numericFamilyId } })
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

  const joinRequest = await prisma.familyJoinRequest.create({
    data: {
      familyId: numericFamilyId,
      userId: Number(userId),
      message: message || null
    }
  })

  return {
    id: joinRequest.id,
    familyId: joinRequest.familyId,
    status: joinRequest.status,
    message: joinRequest.message
  }
}

module.exports = {
  createFamily,
  listMyFamilies,
  getFamilyByInviteCode,
  updateFamilyNickname,
  updateRelationship,
  createJoinRequest
}
