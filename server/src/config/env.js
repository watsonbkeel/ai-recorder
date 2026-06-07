const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

module.exports = {
  PORT: Number(process.env.PORT || 3001),
  HOST: process.env.HOST || '127.0.0.1',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'replace_with_a_long_random_secret',
  WECHAT_APPID: process.env.WECHAT_APPID || '',
  WECHAT_SECRET: process.env.WECHAT_SECRET || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://token.bkeel.com/v1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL || process.env.OPENAI_AUDIO_MODEL || 'whisper-1',
  OPENAI_TIMEOUT_MS: Number(process.env.OPENAI_TIMEOUT_MS || 30000),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'https://recorder.bkeel.com',
  UPLOAD_DIR,
  UPLOAD_DIR_ABS: path.resolve(__dirname, '../../', UPLOAD_DIR)
}
