const { PrismaClient } = require('@prisma/client')

const prisma = global.__aiRecorderPrisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.__aiRecorderPrisma = prisma
}

module.exports = prisma
