const crypto = require('crypto')
const { promisify } = require('util')
const axios = require('axios')
const prisma = require('../utils/prisma')
const { signToken } = require('../utils/jwt')
const { createError } = require('../utils/errors')
const { WECHAT_APPID, WECHAT_SECRET } = require('../config/env')

const scryptAsync = promisify(crypto.scrypt)

function normalizeAccountName(value) {
  return String(value || '').trim().toLowerCase()
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, 64)
  return `${salt}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash || !passwordHash.includes(':')) {
    return false
  }
  const [salt, storedHash] = passwordHash.split(':')
  const derivedKey = await scryptAsync(password, salt, 64)
  const storedBuffer = Buffer.from(storedHash, 'hex')
  return storedBuffer.length === derivedKey.length && crypto.timingSafeEqual(storedBuffer, derivedKey)
}

function buildAuthResult(user) {
  const token = signToken({ userId: user.id })
  return {
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      isGlobalAdmin: user.isGlobalAdmin
    }
  }
}

async function fetchWechatSession(code) {
  if (!WECHAT_APPID || !WECHAT_SECRET || WECHAT_SECRET === 'your_wechat_secret') {
    throw createError('WECHAT_NOT_CONFIGURED', '微信登录未配置 WECHAT_APPID 或 WECHAT_SECRET', 503)
  }

  const response = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
    timeout: 10000,
    params: {
      appid: WECHAT_APPID,
      secret: WECHAT_SECRET,
      js_code: code,
      grant_type: 'authorization_code'
    }
  }).catch((error) => {
    const status = error.response ? error.response.status : 502
    throw createError('WECHAT_PROVIDER_FAILED', `微信登录服务调用失败: ${status}`, 502)
  })

  const data = response.data || {}
  if (data.errcode) {
    throw createError('WECHAT_PROVIDER_FAILED', data.errmsg || `微信登录失败: ${data.errcode}`, 502)
  }
  if (!data.openid) {
    throw createError('WECHAT_PROVIDER_FAILED', '微信登录未返回 openid', 502)
  }
  return data
}

async function wechatLogin(payload) {
  const code = String(payload.code || '').trim()
  const nickname = String(payload.nickname || '').trim()
  const avatarUrl = String(payload.avatarUrl || '').trim()

  if (!code) {
    throw createError('VALIDATION_ERROR', '微信登录 code 不能为空', 400)
  }

  const session = await fetchWechatSession(code)
  const existingUser = await prisma.user.findUnique({ where: { wechatOpenid: session.openid } })
  const updateData = {
    ...(nickname ? { nickname } : {}),
    ...(avatarUrl ? { avatarUrl } : {})
  }
  const user = existingUser
    ? (Object.keys(updateData).length
        ? await prisma.user.update({ where: { id: existingUser.id }, data: updateData })
        : existingUser)
    : await prisma.user.create({
        data: {
          wechatOpenid: session.openid,
          nickname: nickname || '家人',
          avatarUrl,
          isGlobalAdmin: false
        }
      })

  return buildAuthResult(user)
}

async function registerWithPassword(payload) {
  const accountName = normalizeAccountName(payload.accountName)
  const password = String(payload.password || '')
  const nickname = String(payload.nickname || '').trim() || accountName

  if (!/^[a-z0-9_\-.]{3,32}$/.test(accountName)) {
    throw createError('VALIDATION_ERROR', '账号名需为 3-32 位字母、数字、下划线、横线或点', 400)
  }
  if (password.length < 6 || password.length > 64) {
    throw createError('VALIDATION_ERROR', '密码需为 6-64 位', 400)
  }

  const exists = await prisma.user.findUnique({ where: { accountName } })
  if (exists) {
    throw createError('ALREADY_EXISTS', '账号名已存在', 400)
  }

  const user = await prisma.user.create({
    data: {
      accountName,
      passwordHash: await hashPassword(password),
      nickname,
      avatarUrl: '',
      isGlobalAdmin: false
    }
  })

  return buildAuthResult(user)
}

async function loginWithPassword(payload) {
  const accountName = normalizeAccountName(payload.accountName)
  const password = String(payload.password || '')

  if (!accountName || !password) {
    throw createError('VALIDATION_ERROR', '请输入账号名和密码', 400)
  }

  const user = await prisma.user.findUnique({ where: { accountName } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw createError('INVALID_CREDENTIALS', '账号名或密码错误', 401)
  }

  return buildAuthResult(user)
}

async function getCurrentUser(userId) {
  return prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, nickname: true, avatarUrl: true, isGlobalAdmin: true }
  })
}

async function updateCurrentUser(userId, payload) {
  const nickname = String(payload.nickname || '').trim()
  const avatarUrl = String(payload.avatarUrl || '').trim()

  if (!nickname) {
    throw createError('VALIDATION_ERROR', '昵称不能为空', 400)
  }

  const user = await prisma.user.update({
    where: { id: Number(userId) },
    data: {
      nickname,
      avatarUrl
    },
    select: { id: true, nickname: true, avatarUrl: true, isGlobalAdmin: true }
  })

  return user
}

module.exports = {
  wechatLogin,
  registerWithPassword,
  loginWithPassword,
  getCurrentUser,
  updateCurrentUser
}
