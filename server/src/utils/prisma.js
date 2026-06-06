const { PrismaClient } = require('@prisma/client')

const prisma = global.__classDiaryPrisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.__classDiaryPrisma = prisma
}

module.exports = prisma
