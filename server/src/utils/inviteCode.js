function randomChunk(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let index = 0; index < length; index += 1) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function generateInviteCode() {
  return randomChunk(6 + Math.floor(Math.random() * 3))
}

module.exports = {
  generateInviteCode
}
