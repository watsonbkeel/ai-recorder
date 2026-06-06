const prisma = require('../utils/prisma')

function buildPagination(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1
  }
}

function normalizePage(query) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10))
  return { page, pageSize }
}

async function createNotification(data, tx) {
  const client = tx || prisma
  const notificationData = {
    userId: data.userId || data.receiverId,
    actorId: data.actorId || data.triggerUserId || null,
    classId: data.classId || null,
    type: data.type,
    title: data.title,
    content: data.content,
    diaryId: data.diaryId || null,
    commentId: data.commentId || null
  }
  return client.notification.create({ data: notificationData })
}

async function listNotifications(userId, query) {
  const { page, pageSize } = normalizePage(query)
  const where = { userId: Number(userId) }
  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: {
          select: { id: true, nickname: true, avatarUrl: true }
        },
        class: {
          select: { id: true, name: true }
        }
      }
    })
  ])

  return {
    items: items.map((item) => ({
      ...item,
      actor: item.actor ? {
        id: item.actor.id,
        nickname: item.actor.nickname || '同学',
        avatarUrl: item.actor.avatarUrl || ''
      } : null
    })),
    pagination: buildPagination(page, pageSize, total)
  }
}

async function getUnreadCount(userId) {
  const count = await prisma.notification.count({
    where: { userId: Number(userId), isRead: false }
  })
  return { count }
}

async function markRead(userId, notificationId) {
  await prisma.notification.updateMany({
    where: { id: Number(notificationId), userId: Number(userId) },
    data: { isRead: true }
  })
  return { id: Number(notificationId) }
}

async function markAllRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId: Number(userId), isRead: false },
    data: { isRead: true }
  })
  return { updatedCount: result.count }
}

module.exports = {
  createNotification,
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead
}
