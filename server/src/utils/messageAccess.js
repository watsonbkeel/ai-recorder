function canViewMessage(message, userId, viewerMember) {
  const numericUserId = Number(userId)
  if (!message) {
    return false
  }
  if (message.senderId === numericUserId) {
    return true
  }
  if (message.visibility === 'family') {
    return true
  }
  if ((message.receivers || []).some((receiver) => Number(receiver.userId) === numericUserId)) {
    return true
  }
  const slotKey = viewerMember && viewerMember.slotKey
  return Boolean(slotKey && (message.slotReceivers || []).some((receiver) => receiver.slotKey === slotKey))
}

function messageVisibleToUserWhere(userId, memberships = []) {
  const numericUserId = Number(userId)
  const slotConditions = memberships
    .filter((member) => member.slotKey)
    .map((member) => ({
      familyId: Number(member.familyId),
      slotKey: member.slotKey
    }))

  return {
    OR: [
      { senderId: numericUserId },
      { visibility: 'family' },
      { receivers: { some: { userId: numericUserId } } },
      ...(slotConditions.length ? [{
        slotReceivers: {
          some: { OR: slotConditions }
        }
      }] : [])
    ]
  }
}

module.exports = {
  canViewMessage,
  messageVisibleToUserWhere
}
