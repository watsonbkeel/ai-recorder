const RELATIONSHIP_LABELS = {
  father: '爸爸',
  mother: '妈妈',
  son: '儿子',
  daughter: '女儿',
  child: '孩子',
  grandfather: '爷爷/外公',
  grandmother: '奶奶/外婆',
  grandparent: '祖辈',
  partner: '伴侣',
  sibling: '兄弟姐妹',
  other: '家人'
}

const GENDER_LABELS = {
  male: '男孩/男性',
  female: '女孩/女性',
  unspecified: '未设置'
}

const VALID_RELATIONSHIPS = new Set(Object.keys(RELATIONSHIP_LABELS))
const VALID_GENDERS = new Set(Object.keys(GENDER_LABELS))
const RELATIONSHIP_SORT_GROUP = {
  father: 10,
  mother: 10,
  partner: 15,
  son: 20,
  daughter: 20,
  child: 20,
  sibling: 30,
  grandfather: 40,
  grandmother: 40,
  grandparent: 40,
  other: 90
}
const RELATIONSHIP_SORT_ORDER = Object.keys(RELATIONSHIP_LABELS)
  .reduce((map, relationship, index) => ({ ...map, [relationship]: index }), {})
const GENDER_SORT_ORDER = { female: 1, male: 2, unspecified: 3 }

function normalizeRelationship(value) {
  return VALID_RELATIONSHIPS.has(value) ? value : 'other'
}

function normalizeGender(value) {
  return VALID_GENDERS.has(value) ? value : 'unspecified'
}

function normalizeOptionalInt(value, min, max) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    return null
  }
  return number
}

function normalizeText(value, maxLength) {
  const text = String(value || '').trim()
  if (!text) {
    return null
  }
  return text.slice(0, maxLength)
}

function normalizeIdentityPayload(payload = {}) {
  const currentYear = new Date().getFullYear()
  const relationship = normalizeRelationship(payload.relationship)
  return {
    relationship,
    gender: normalizeGender(payload.gender),
    childOrder: isChildRelationship(relationship) ? normalizeOptionalInt(payload.childOrder, 1, 20) : null,
    birthYear: normalizeOptionalInt(payload.birthYear, 1900, currentYear),
    familyNickname: normalizeText(payload.familyNickname || payload.nickname, 191),
    preferredTitle: normalizeText(payload.preferredTitle, 191),
    identityNote: normalizeText(payload.identityNote, 500)
  }
}

function normalizeIdentityUpdatePayload(payload = {}, existing = {}) {
  const currentYear = new Date().getFullYear()
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key)
  const relationship = has('relationship') ? normalizeRelationship(payload.relationship) : normalizeRelationship(existing.relationship)
  return {
    relationship,
    gender: has('gender') ? normalizeGender(payload.gender) : normalizeGender(existing.gender),
    childOrder: isChildRelationship(relationship)
      ? (has('childOrder') ? normalizeOptionalInt(payload.childOrder, 1, 20) : (existing.childOrder || null))
      : null,
    birthYear: has('birthYear') ? normalizeOptionalInt(payload.birthYear, 1900, currentYear) : (existing.birthYear || null),
    familyNickname: has('familyNickname') || has('nickname')
      ? normalizeText(payload.familyNickname || payload.nickname, 191)
      : (existing.familyNickname || null),
    preferredTitle: has('preferredTitle') ? normalizeText(payload.preferredTitle, 191) : (existing.preferredTitle || null),
    identityNote: has('identityNote') ? normalizeText(payload.identityNote, 500) : (existing.identityNote || null)
  }
}

function childOrderLabel(childOrder) {
  if (!childOrder) {
    return ''
  }
  if (childOrder === 1) {
    return '老大'
  }
  if (childOrder === 2) {
    return '老二'
  }
  if (childOrder === 3) {
    return '老三'
  }
  return `第${childOrder}个孩子`
}

function relationshipLabel(relationship) {
  return RELATIONSHIP_LABELS[relationship] || RELATIONSHIP_LABELS.other
}

function genderLabel(gender) {
  return GENDER_LABELS[gender] || GENDER_LABELS.unspecified
}

function isChildRelationship(relationship) {
  return ['son', 'daughter', 'child'].includes(relationship)
}

function buildIdentityText(member) {
  if (!member) {
    return '家人'
  }

  if (member.preferredTitle) {
    return member.preferredTitle
  }

  const relationship = normalizeRelationship(member.relationship)
  const baseLabel = relationshipLabel(relationship)
  if (isChildRelationship(relationship) && member.childOrder) {
    return `${childOrderLabel(member.childOrder)}${baseLabel}`
  }
  return baseLabel
}

function mapIdentity(member) {
  const relationship = normalizeRelationship(member && member.relationship)
  const gender = normalizeGender(member && member.gender)
  const childOrder = member && isChildRelationship(relationship) && member.childOrder ? member.childOrder : null
  return {
    relationship,
    relationshipLabel: relationshipLabel(relationship),
    gender,
    genderLabel: genderLabel(gender),
    childOrder,
    childOrderLabel: childOrder ? childOrderLabel(childOrder) : '',
    birthYear: member && member.birthYear ? member.birthYear : null,
    familyNickname: member && member.familyNickname ? member.familyNickname : '',
    preferredTitle: member && member.preferredTitle ? member.preferredTitle : '',
    identityNote: member && member.identityNote ? member.identityNote : '',
    identityText: buildIdentityText(member)
  }
}

function displayName(user, member) {
  const identity = mapIdentity(member)
  return identity.familyNickname || (user && user.nickname) || identity.identityText || '家人'
}

function identitySelect() {
  return {
    familyId: true,
    userId: true,
    relationship: true,
    gender: true,
    childOrder: true,
    birthYear: true,
    familyNickname: true,
    preferredTitle: true,
    identityNote: true
  }
}

function familyUserSelect(familyId) {
  return {
    id: true,
    nickname: true,
    avatarUrl: true,
    familyMembers: {
      where: { familyId: Number(familyId) },
      select: identitySelect(),
      take: 1
    }
  }
}

function getUserFamilyMember(user, familyId) {
  if (!user || !Array.isArray(user.familyMembers)) {
    return null
  }
  return user.familyMembers.find((item) => Number(item.familyId) === Number(familyId)) || null
}

function mapFamilyUser(user, familyId) {
  const member = getUserFamilyMember(user, familyId)
  const identity = mapIdentity(member)
  return {
    id: user.id,
    nickname: displayName(user, member),
    avatarUrl: user.avatarUrl || '',
    ...identity
  }
}

function mapMember(member, currentUserId) {
  const identity = mapIdentity(member)
  const user = member.user || {}
  return {
    id: member.id,
    familyId: member.familyId,
    userId: member.userId,
    role: member.role,
    isMuted: member.isMuted,
    joinedAt: member.joinedAt,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    isSelf: Number(member.userId) === Number(currentUserId),
    ...identity,
    displayName: displayName(user, member),
    user: {
      id: user.id,
      nickname: user.nickname || '',
      avatarUrl: user.avatarUrl || '',
      isGlobalAdmin: Boolean(user.isGlobalAdmin)
    }
  }
}

function compareNullableNumber(left, right) {
  const normalizedLeft = Number.isFinite(Number(left)) ? Number(left) : Number.MAX_SAFE_INTEGER
  const normalizedRight = Number.isFinite(Number(right)) ? Number(right) : Number.MAX_SAFE_INTEGER
  return normalizedLeft - normalizedRight
}

function compareDate(left, right) {
  return new Date(left || 0).getTime() - new Date(right || 0).getTime()
}

function compareFamilyMembers(left, right) {
  const leftRelationship = normalizeRelationship(left.relationship)
  const rightRelationship = normalizeRelationship(right.relationship)
  const leftGroup = RELATIONSHIP_SORT_GROUP[leftRelationship] || RELATIONSHIP_SORT_GROUP.other
  const rightGroup = RELATIONSHIP_SORT_GROUP[rightRelationship] || RELATIONSHIP_SORT_GROUP.other
  if (leftGroup !== rightGroup) {
    return leftGroup - rightGroup
  }

  if (isChildRelationship(leftRelationship) && isChildRelationship(rightRelationship)) {
    const childOrderCompare = compareNullableNumber(left.childOrder, right.childOrder)
    if (childOrderCompare !== 0) {
      return childOrderCompare
    }
    const birthYearCompare = compareNullableNumber(left.birthYear, right.birthYear)
    if (birthYearCompare !== 0) {
      return birthYearCompare
    }
  }

  const relationshipCompare = (RELATIONSHIP_SORT_ORDER[leftRelationship] || 0) - (RELATIONSHIP_SORT_ORDER[rightRelationship] || 0)
  if (relationshipCompare !== 0) {
    return relationshipCompare
  }

  const genderCompare = (GENDER_SORT_ORDER[normalizeGender(left.gender)] || GENDER_SORT_ORDER.unspecified) -
    (GENDER_SORT_ORDER[normalizeGender(right.gender)] || GENDER_SORT_ORDER.unspecified)
  if (genderCompare !== 0) {
    return genderCompare
  }

  const leftRoleRank = left.role === 'admin' ? 0 : 1
  const rightRoleRank = right.role === 'admin' ? 0 : 1
  if (leftRoleRank !== rightRoleRank) {
    return leftRoleRank - rightRoleRank
  }

  return compareDate(left.joinedAt, right.joinedAt) || Number(left.id || 0) - Number(right.id || 0)
}

function sortFamilyMembers(members) {
  return [...members].sort(compareFamilyMembers)
}

module.exports = {
  RELATIONSHIP_LABELS,
  GENDER_LABELS,
  VALID_RELATIONSHIPS,
  VALID_GENDERS,
  normalizeRelationship,
  normalizeGender,
  normalizeIdentityPayload,
  normalizeIdentityUpdatePayload,
  relationshipLabel,
  genderLabel,
  childOrderLabel,
  buildIdentityText,
  mapIdentity,
  displayName,
  identitySelect,
  familyUserSelect,
  getUserFamilyMember,
  mapFamilyUser,
  mapMember,
  sortFamilyMembers
}
