const prisma = require('../utils/prisma')
const { verifyToken } = require('../utils/jwt')
const { createError } = require('../utils/errors')

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''

  if (!token) {
    return next(createError('UNAUTHORIZED', '未登录或 token 无效', 401))
  }

  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, nickname: true, avatarUrl: true, isGlobalAdmin: true }
    })

    if (!user) {
      throw createError('UNAUTHORIZED', '未登录或 token 无效', 401)
    }

    req.user = user
    return next()
  } catch (error) {
    return next(createError('UNAUTHORIZED', '未登录或 token 无效', 401))
  }
}

async function getClassMember(userId, classId) {
  return prisma.classMember.findUnique({
    where: {
      classId_userId: {
        classId: Number(classId),
        userId: Number(userId)
      }
    }
  })
}

async function ensureClassMember(userId, classId) {
  const member = await getClassMember(userId, classId)
  if (!member) {
    throw createError('NOT_CLASS_MEMBER', '不是班级成员', 403)
  }
  return member
}

async function ensureClassAdmin(userId, classId) {
  const member = await ensureClassMember(userId, classId)
  if (member.role !== 'admin') {
    throw createError('NOT_CLASS_ADMIN', '不是班级管理员', 403)
  }
  return member
}

async function ensureNotMuted(userId, classId) {
  const member = await ensureClassMember(userId, classId)
  if (member.isMuted) {
    throw createError('USER_MUTED', '用户已被禁言', 403)
  }
  return member
}

module.exports = {
  requireAuth,
  getClassMember,
  ensureClassMember,
  ensureClassAdmin,
  ensureNotMuted
}
