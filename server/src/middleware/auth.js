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

async function getFamilyMember(userId, familyId) {
  return prisma.familyMember.findUnique({
    where: {
      familyId_userId: {
        familyId: Number(familyId),
        userId: Number(userId)
      }
    }
  })
}

async function ensureFamilyMember(userId, familyId) {
  const member = await getFamilyMember(userId, familyId)
  if (!member) {
    throw createError('NOT_FAMILY_MEMBER', '不是家庭成员', 403)
  }
  return member
}

async function ensureFamilyAdmin(userId, familyId) {
  const member = await ensureFamilyMember(userId, familyId)
  if (member.role !== 'admin') {
    throw createError('NOT_FAMILY_ADMIN', '不是家庭管理员', 403)
  }
  return member
}

async function ensureFamilyNotMuted(userId, familyId) {
  const member = await ensureFamilyMember(userId, familyId)
  if (member.isMuted) {
    throw createError('USER_MUTED', '用户已被禁言', 403)
  }
  return member
}

module.exports = {
  requireAuth,
  getFamilyMember,
  ensureFamilyMember,
  ensureFamilyAdmin,
  ensureFamilyNotMuted
}
