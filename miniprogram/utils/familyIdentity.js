const RELATIONSHIP_OPTIONS = [
  { value: 'father', label: '父亲' },
  { value: 'mother', label: '母亲' },
  { value: 'son', label: '儿子' },
  { value: 'daughter', label: '女儿' },
  { value: 'child', label: '子女' },
  { value: 'grandfather', label: '爷爷/外公' },
  { value: 'grandmother', label: '奶奶/外婆' },
  { value: 'grandparent', label: '祖辈' },
  { value: 'partner', label: '伴侣' },
  { value: 'sibling', label: '兄弟姐妹' },
  { value: 'other', label: '其他家人' }
]

const GENDER_OPTIONS = [
  { value: 'unspecified', label: '未设置' },
  { value: 'male', label: '男孩/男性' },
  { value: 'female', label: '女孩/女性' }
]

function optionLabels(options) {
  return options.map((item) => item.label)
}

function optionIndex(options, value) {
  const index = options.findIndex((item) => item.value === value)
  return index >= 0 ? index : 0
}

function optionValue(options, index) {
  return options[Number(index)] ? options[Number(index)].value : options[0].value
}

function buildIdentityPayload(data) {
  return {
    relationship: data.relationship || 'other',
    gender: data.gender || 'unspecified',
    childOrder: data.childOrder ? Number(data.childOrder) : null,
    birthYear: data.birthYear ? Number(data.birthYear) : null,
    familyNickname: String(data.familyNickname || '').trim(),
    preferredTitle: String(data.preferredTitle || '').trim(),
    identityNote: String(data.identityNote || '').trim()
  }
}

function identitySummary(item) {
  if (!item) {
    return '未设置身份'
  }
  const parts = [
    item.identityText || item.relationshipLabel,
    item.genderLabel && item.gender !== 'unspecified' ? item.genderLabel : '',
    item.childOrderLabel,
    item.birthYear ? `${item.birthYear}年` : ''
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '未设置身份'
}

module.exports = {
  RELATIONSHIP_OPTIONS,
  GENDER_OPTIONS,
  RELATIONSHIP_LABELS: optionLabels(RELATIONSHIP_OPTIONS),
  GENDER_LABELS: optionLabels(GENDER_OPTIONS),
  optionIndex,
  optionValue,
  buildIdentityPayload,
  identitySummary
}
