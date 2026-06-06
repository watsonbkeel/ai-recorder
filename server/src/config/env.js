const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  HOST: process.env.HOST || '127.0.0.1',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'replace_with_a_long_random_secret',
  WECHAT_APPID: process.env.WECHAT_APPID || '',
  WECHAT_SECRET: process.env.WECHAT_SECRET || '',
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'http://127.0.0.1:3000',
  UPLOAD_DIR,
  UPLOAD_DIR_ABS: path.resolve(__dirname, '../../', UPLOAD_DIR)
}
