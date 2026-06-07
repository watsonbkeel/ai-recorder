const DEFAULT_FAMILY_SLOTS = [
  { key: 'father', label: '爸爸', group: 'parent', relationship: 'father', gender: 'male', childOrder: null },
  { key: 'mother', label: '妈妈', group: 'parent', relationship: 'mother', gender: 'female', childOrder: null },
  { key: 'child_1', label: '老大', group: 'child', relationship: 'child', gender: 'unspecified', childOrder: 1 },
  { key: 'child_2', label: '老二', group: 'child', relationship: 'child', gender: 'unspecified', childOrder: 2 },
  { key: 'child_3', label: '老三', group: 'child', relationship: 'child', gender: 'unspecified', childOrder: 3 }
]

const SLOT_MAP = DEFAULT_FAMILY_SLOTS.reduce((map, slot) => {
  map[slot.key] = slot
  return map
}, {})

function normalizeSlotKey(value) {
  const key = String(value || '').trim()
  return SLOT_MAP[key] ? key : null
}

function getSlotMeta(slotKey) {
  const key = normalizeSlotKey(slotKey)
  return key ? SLOT_MAP[key] : null
}

function isChildSlot(slotKey) {
  const slot = getSlotMeta(slotKey)
  return Boolean(slot && slot.group === 'child')
}

function relationshipFromSlot(slotKey, requestedRelationship) {
  const slot = getSlotMeta(slotKey)
  if (!slot) {
    return requestedRelationship || 'other'
  }
  if (slot.group === 'child') {
    return ['son', 'daughter', 'child'].includes(requestedRelationship) ? requestedRelationship : 'child'
  }
  return slot.relationship
}

function genderFromRelationship(relationship, fallback = 'unspecified') {
  if (relationship === 'father' || relationship === 'son') {
    return 'male'
  }
  if (relationship === 'mother' || relationship === 'daughter') {
    return 'female'
  }
  return fallback || 'unspecified'
}

function identityPatchFromSlot(slotKey, requestedRelationship) {
  const slot = getSlotMeta(slotKey)
  if (!slot) {
    return {}
  }
  const relationship = relationshipFromSlot(slotKey, requestedRelationship)
  return {
    slotKey: slot.key,
    relationship,
    gender: genderFromRelationship(relationship, slot.gender),
    childOrder: slot.group === 'child' ? slot.childOrder : null
  }
}

function slotLabel(slotKey, relationship) {
  const slot = getSlotMeta(slotKey)
  if (!slot) {
    return '家人'
  }
  if (slot.group !== 'child') {
    return slot.label
  }
  if (relationship === 'son') {
    return `${slot.label}儿子`
  }
  if (relationship === 'daughter') {
    return `${slot.label}女儿`
  }
  return `${slot.label}孩子`
}

function normalizeSlotKeys(values) {
  return Array.from(new Set((values || [])
    .map(normalizeSlotKey)
    .filter(Boolean)))
    .slice(0, DEFAULT_FAMILY_SLOTS.length)
}

module.exports = {
  DEFAULT_FAMILY_SLOTS,
  normalizeSlotKey,
  normalizeSlotKeys,
  getSlotMeta,
  isChildSlot,
  relationshipFromSlot,
  genderFromRelationship,
  identityPatchFromSlot,
  slotLabel
}
