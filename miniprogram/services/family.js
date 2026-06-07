const request = require('../utils/request')
const familySlots = require('../utils/familySlots')

function createFamily(data) {
  return request({ url: '/families', method: 'POST', data })
}

function getMyFamilies() {
  return request({ url: '/families/my' })
}

function getFamilyByInvite(inviteCode) {
  const code = encodeURIComponent(String(inviteCode || '').trim())
  return request({ url: `/families/by-invite/${code}` })
}

function getFamilyMembers(familyId) {
  return request({ url: `/families/${familyId}/members` })
}

function getFamilyLayout(familyId) {
  return request({ url: `/families/${familyId}/layout`, silent: true }).catch(async (error) => {
    if (error.code !== 'NOT_FOUND') {
      throw error
    }
    const members = await getFamilyMembers(familyId)
    return {
      id: Number(familyId),
      members,
      slots: familySlots.DEFAULT_FAMILY_SLOTS.map((slot) => ({
        ...slot,
        displayLabel: familySlots.slotLabel(slot.key),
        occupied: false,
        member: null
      })).map((slot) => {
        const member = (members || []).find((item) => item.slotKey === slot.key)
        return {
          ...slot,
          occupied: Boolean(member),
          member: member || null
        }
      })
    }
  })
}

function updateIdentity(familyId, data) {
  return request({ url: `/families/${familyId}/identity`, method: 'PATCH', data })
}

function updateFamilyNickname(familyId, data) {
  return request({ url: `/families/${familyId}/nickname`, method: 'PATCH', data })
}

function updateRelationship(familyId, data) {
  return request({ url: `/families/${familyId}/relationship`, method: 'PATCH', data })
}

function createJoinRequest(familyId, data) {
  return request({ url: `/families/${familyId}/join-requests`, method: 'POST', data })
}

module.exports = {
  createFamily,
  getMyFamilies,
  getFamilyByInvite,
  getFamilyMembers,
  getFamilyLayout,
  updateIdentity,
  updateFamilyNickname,
  updateRelationship,
  createJoinRequest
}
