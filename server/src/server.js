const app = require('./app')
const { HOST, PORT } = require('./config/env')

app.listen(PORT, HOST, () => {
  console.log(`AI Recorder server running at http://${HOST}:${PORT}`)
})
