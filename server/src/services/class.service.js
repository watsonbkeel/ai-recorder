const prisma = require('../utils/prisma')
const { createError } = require('../utils/errors')
const { generateInviteCode } = require('../utils/inviteCode')

async function createUniqueInviteCode(tx) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = generateInviteCode()
    const exists = await tx.class.findUnique({ where: { inviteCode } })
    if (!exists) {
      return inviteCode
    }
  }
  throw createError('INTERNAL_ERROR', '生成邀请码失败', 500)
}

async function createClass(userId, payload) {
  const name = String(payload.name || '').trim()
  const description = String(payload.description || '').trim()

  if (!name) {
    throw createError('VALIDATION_ERROR', '班级名称不能为空', 400)
  }

  const user = await prisma.user.findUnique({ where: { id: Number(userId) } })
  if (!user) {
    throw createError('UNAUTHORIZED', '未登录或 token 无效', 401)
  }

  return prisma.$transaction(async (tx) => {
    const inviteCode = await createUniqueInviteCode(tx)
    const createdClass = await tx.class.create({
      data: {
        name,
        description: description || null,
        inviteCode,
        createdById: Number(userId)
      }
    })

    await tx.classMember.create({
      data: {
        classId: createdClass.id,
        userId: Number(userId),
        role: 'admin'
      }
    })

    return {
      id: createdClass.id,
      name: createdClass.name,
      description: createdClass.description,
      inviteCode: createdClass.inviteCode,
      role: 'admin'
    }
  })
}

async function listMyClasses(userId) {
  const memberships = await prisma.classMember.findMany({
    where: { userId: Number(userId) },
    orderBy: { joinedAt: 'desc' },
    include: {
      class: true
    }
  })

  return memberships.map((membership) => ({
    id: membership.class.id,
    name: membership.class.name,
      description: membership.class.description,
      inviteCode: membership.class.inviteCode,
      role: membership.role,
      classNickname: membership.classNickname,
      isMuted: membership.isMuted,
      joinedAt: membership.joinedAt
  }))
}

async function listAllClasses(userId) {
  const classes = await prisma.class.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      members: {
        where: { userId: Number(userId) },
        select: { role: true, classNickname: true, isMuted: true, joinedAt: true }
      },
      joinRequests: {
        where: { userId: Number(userId) },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, message: true, createdAt: true }
      },
      _count: { select: { members: true, diaries: true } }
    }
  })

  return classes.map((classItem) => {
    const member = classItem.members[0]
    const joinRequest = classItem.joinRequests[0]
    return {
      id: classItem.id,
      name: classItem.name,
      description: classItem.description,
      inviteCode: classItem.inviteCode,
      memberCount: classItem._count.members,
      diaryCount: classItem._count.diaries,
      role: member ? member.role : null,
      classNickname: member ? member.classNickname : null,
      isMuted: member ? member.isMuted : false,
      joinedAt: member ? member.joinedAt : null,
      joinStatus: member ? 'joined' : (joinRequest ? joinRequest.status : 'none'),
      joinRequestId: joinRequest ? joinRequest.id : null
    }
  })
}

async function updateClassNickname(userId, classId, payload) {
  const numericClassId = Number(classId)
  const classNickname = String(payload.classNickname || '').trim()

  if (!classNickname) {
    throw createError('VALIDATION_ERROR', '班级昵称不能为空', 400)
  }

  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId: numericClassId, userId: Number(userId) } },
    include: { class: true }
  })

  if (!member) {
    throw createError('FORBIDDEN', '未加入该班级', 403)
  }

  const updated = await prisma.classMember.update({
    where: { id: member.id },
    data: { classNickname }
  })

  return {
    id: member.class.id,
    name: member.class.name,
    description: member.class.description,
    inviteCode: member.class.inviteCode,
    role: updated.role,
    classNickname: updated.classNickname,
    isMuted: updated.isMuted,
    joinedAt: updated.joinedAt
  }
}

async function getClassByInviteCode(inviteCode) {
  const code = String(inviteCode || '').trim().toUpperCase()
  if (!code) {
    throw createError('VALIDATION_ERROR', '邀请码不能为空', 400)
  }

  const foundClass = await prisma.class.findUnique({ where: { inviteCode: code } })
  if (!foundClass) {
    throw createError('NOT_FOUND', '未找到班级', 404)
  }

  return {
    id: foundClass.id,
    name: foundClass.name,
    description: foundClass.description
  }
}

async function createJoinRequest(userId, classId, payload) {
  const numericClassId = Number(classId)
  const message = String(payload.message || '').trim()
  const foundClass = await prisma.class.findUnique({ where: { id: numericClassId } })

  if (!foundClass) {
    throw createError('NOT_FOUND', '班级不存在', 404)
  }

  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId: numericClassId, userId: Number(userId) } }
  })

  if (member) {
    throw createError('ALREADY_EXISTS', '你已加入该班级', 400)
  }

  const pendingRequest = await prisma.joinRequest.findFirst({
    where: {
      classId: numericClassId,
      userId: Number(userId),
      status: 'pending'
    }
  })

  if (pendingRequest) {
    throw createError('ALREADY_EXISTS', '你已提交申请，请等待审核', 400)
  }

  const joinRequest = await prisma.joinRequest.create({
    data: {
      classId: numericClassId,
      userId: Number(userId),
      message: message || null
    }
  })

  return {
    id: joinRequest.id,
    classId: joinRequest.classId,
    status: joinRequest.status,
    message: joinRequest.message
  }
}

module.exports = {
  createClass,
  listMyClasses,
  listAllClasses,
  updateClassNickname,
  getClassByInviteCode,
  createJoinRequest
}
