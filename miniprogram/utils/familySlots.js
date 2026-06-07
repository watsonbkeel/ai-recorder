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

const CHILD_RELATIONSHIP_OPTIONS = [
  { value: 'son', label: '儿子' },
  { value: 'daughter', label: '女儿' }
]

function normalizeSlotKey(value) {
  const key = String(value || '').trim()
  return SLOT_MAP[key] ? key : ''
}

function getSlot(slotKey) {
  return SLOT_MAP[normalizeSlotKey(slotKey)] || null
}

function isChildSlot(slotKey) {
  const slot = getSlot(slotKey)
  return Boolean(slot && slot.group === 'child')
}

function genderFromRelationship(relationship, fallback) {
  if (relationship === 'father' || relationship === 'son') {
    return 'male'
  }
  if (relationship === 'mother' || relationship === 'daughter') {
    return 'female'
  }
  return fallback || 'unspecified'
}

function slotLabel(slotKey, relationship) {
  const slot = getSlot(slotKey)
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

function slotAvatarText(slotKey, relationship) {
  const label = slotLabel(slotKey, relationship)
  return label.slice(-2)
}

function normalizeChildRelationship(value) {
  return value === 'daughter' ? 'daughter' : 'son'
}

function buildIdentityPayload(data = {}) {
  const slot = getSlot(data.slotKey)
  if (!slot) {
    return {
      slotKey: null,
      relationship: 'other',
      gender: 'unspecified',
      childOrder: null,
      birthYear: data.birthYear ? Number(data.birthYear) : null,
      familyNickname: String(data.familyNickname || '').trim(),
      preferredTitle: String(data.preferredTitle || '').trim(),
      identityNote: String(data.identityNote || '').trim()
    }
  }

  const relationship = slot.group === 'child'
    ? normalizeChildRelationship(data.childRelationship || data.relationship)
    : slot.relationship

  return {
    slotKey: slot.key,
    relationship,
    gender: genderFromRelationship(relationship, slot.gender),
    childOrder: slot.group === 'child' ? slot.childOrder : null,
    birthYear: data.birthYear ? Number(data.birthYear) : null,
    familyNickname: String(data.familyNickname || '').trim(),
    preferredTitle: String(data.preferredTitle || '').trim(),
    identityNote: String(data.identityNote || '').trim()
  }
}

function decorateSlots(slots, selectedSlotKeys) {
  const selected = new Set((selectedSlotKeys || []).map(normalizeSlotKey).filter(Boolean))
  const source = Array.isArray(slots) && slots.length ? slots : DEFAULT_FAMILY_SLOTS
  return source.map((item) => {
    const slot = getSlot(item.key || item.slotKey) || item
    const member = item.member || null
    const relationship = member ? member.relationship : item.relationship
    return {
      ...item,
      key: slot.key,
      label: slot.label,
      group: slot.group,
      childOrder: slot.childOrder,
      displayLabel: item.displayLabel || slotLabel(slot.key, relationship),
      avatarText: slotAvatarText(slot.key, relationship),
      selected: selected.has(slot.key),
      occupied: Boolean(item.occupied || member),
      member
    }
  })
}

module.exports = {
  DEFAULT_FAMILY_SLOTS,
  CHILD_RELATIONSHIP_OPTIONS,
  normalizeSlotKey,
  getSlot,
  isChildSlot,
  slotLabel,
  slotAvatarText,
  buildIdentityPayload,
  decorateSlots
}
