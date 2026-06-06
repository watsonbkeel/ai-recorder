const auth = require('./auth')

function clearCurrentFamilyIfNeeded(familyId) {
  const currentFamily = auth.getCurrentFamily()
  if (!familyId || (currentFamily && Number(currentFamily.id) === Number(familyId))) {
    auth.clearCurrentFamily()
    getApp().setCurrentFamily(null)
  }
}

function downgradeCurrentFamilyIfNeeded(familyId) {
  const currentFamily = auth.getCurrentFamily()
  if (!currentFamily || Number(currentFamily.id) !== Number(familyId)) {
    return
  }

  const downgradedFamily = { ...currentFamily, role: 'member' }
  auth.setCurrentFamily(downgradedFamily)
  getApp().setCurrentFamily(downgradedFamily)
}

function handleFamilyAccessError(error, familyId) {
  if (!error || !error.code) {
    return false
  }

  if (error.code === 'NOT_FAMILY_MEMBER') {
    clearCurrentFamilyIfNeeded(familyId)
    wx.showToast({ title: '你已不在这个家庭，请重新选择', icon: 'none' })
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/family-select/family-select' })
    }, 500)
    return true
  }

  if (error.code === 'NOT_FAMILY_ADMIN') {
    downgradeCurrentFamilyIfNeeded(familyId)
    wx.showToast({ title: '你已不是家庭管理员', icon: 'none' })
    setTimeout(() => {
      if (familyId) {
        wx.redirectTo({ url: `/pages/message-list/message-list?familyId=${familyId}` })
      } else {
        wx.navigateBack()
      }
    }, 500)
    return true
  }

  return false
}

module.exports = {
  handleFamilyAccessError
}
