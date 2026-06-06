const app = require('./app')
const { HOST, PORT } = require('./config/env')

app.listen(PORT, HOST, () => {
  console.log(`Class Diary server running at http://${HOST}:${PORT}`)
})
