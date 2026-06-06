// Paste this snippet into the WeChat DevTools console for local backend testing.
// Use your Mac LAN IP instead of 127.0.0.1 when previewing on a real phone.
wx.setStorageSync('AI_RECORDER_LOCAL_CONFIG', {
  PUBLIC_BASE_URL: 'http://127.0.0.1:3000',
  API_BASE_URL: 'http://127.0.0.1:3000/api'
})

// Clear the override after local testing:
// wx.removeStorageSync('AI_RECORDER_LOCAL_CONFIG')
