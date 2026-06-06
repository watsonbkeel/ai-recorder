const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')

function run(label, command, args, options = {}) {
  process.stdout.write(`\n> ${label}\n`)
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    shell: false
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed`)
  }
}

function walkFiles(dir, predicate, output = []) {
  if (!fs.existsSync(dir)) {
    return output
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        continue
      }
      walkFiles(fullPath, predicate, output)
    } else if (predicate(fullPath)) {
      output.push(fullPath)
    }
  }
  return output
}

function checkJavaScriptSyntax() {
  const files = [
    ...walkFiles(path.join(root, 'miniprogram'), (file) => file.endsWith('.js')),
    ...walkFiles(path.join(root, 'server', 'src'), (file) => file.endsWith('.js')),
    ...walkFiles(path.join(root, 'scripts'), (file) => file.endsWith('.js'))
  ]

  for (const file of files) {
    run(`node --check ${path.relative(root, file)}`, 'node', ['--check', file])
  }
}

function checkMiniProgramPages() {
  process.stdout.write('\n> mini program page manifest\n')
  const appJsonPath = path.join(root, 'miniprogram', 'app.json')
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
  const missing = []

  for (const page of appJson.pages || []) {
    for (const ext of ['js', 'wxml', 'wxss', 'json']) {
      const file = path.join(root, 'miniprogram', `${page}.${ext}`)
      if (!fs.existsSync(file)) {
        missing.push(path.relative(root, file))
      }
    }
  }

  if (missing.length) {
    throw new Error(`Missing mini program page files:\n${missing.join('\n')}`)
  }
  process.stdout.write(`checked ${appJson.pages.length} pages\n`)
}

function gitTrackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    shell: false
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || 'git ls-files failed')
  }
  return result.stdout.split('\0').filter(Boolean)
}

function checkTrackedSecrets() {
  process.stdout.write('\n> tracked secret scan\n')
  const secretPatterns = [
    /ghp_[A-Za-z0-9_]+/g,
    /github_pat_[A-Za-z0-9_]+/g,
    /sk-[A-Za-z0-9]{20,}/g,
    /OPENAI_API_KEY\s*=\s*["']?(sk-[A-Za-z0-9]{20,})/g
  ]
  const findings = []

  for (const file of gitTrackedFiles()) {
    const fullPath = path.join(root, file)
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      continue
    }
    const content = fs.readFileSync(fullPath, 'utf8')
    secretPatterns.forEach((pattern) => {
      const matches = content.match(pattern)
      if (matches) {
        findings.push(`${file}: ${matches[0].slice(0, 12)}...`)
      }
    })
  }

  if (findings.length) {
    throw new Error(`Potential tracked secrets found:\n${findings.join('\n')}`)
  }
  process.stdout.write('no tracked secrets matched\n')
}

function checkTrackedLocalArtifacts() {
  process.stdout.write('\n> tracked local artifact scan\n')
  const findings = []

  for (const file of gitTrackedFiles()) {
    const basename = path.basename(file)
    const isEnvLike = (
      basename === '.env' ||
      basename.startsWith('.env.')
    )
    const isEnvFile = (
      isEnvLike &&
      basename !== '.env.example'
    )
    const isUpload = file.startsWith('server/uploads/') && file !== 'server/uploads/.gitkeep'
    const isRuntimeArtifact = (
      file.startsWith('uploads/') ||
      file.startsWith('node_modules/') ||
      file.startsWith('server/node_modules/') ||
      file.startsWith('miniprogram/miniprogram_npm/') ||
      file.includes('/node_modules/') ||
      file.startsWith('.omo/') ||
      file === 'chat-history.md' ||
      file === 'class-diary-history.md' ||
      file === 'miniprogram/project.private.config.json' ||
      file === 'miniprogram/utils/config.local.js' ||
      basename === '.DS_Store' ||
      basename.startsWith('._') ||
      basename === 'Thumbs.db' ||
      /\.log$/.test(file) ||
      /\.pid(\.lock)?$/.test(file)
    )

    if (isEnvFile || isUpload || isRuntimeArtifact) {
      findings.push(file)
    }
  }

  if (findings.length) {
    throw new Error(`Tracked local/runtime artifacts found:\n${findings.join('\n')}`)
  }
  process.stdout.write('no tracked local artifacts matched\n')
}

function checkProjectBoundaryConfig() {
  process.stdout.write('\n> project boundary config scan\n')
  const envExample = fs.readFileSync(path.join(root, 'server', '.env.example'), 'utf8')
  const dockerCompose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8')
  const projectConfig = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram', 'project.config.json'), 'utf8'))
  const openAiKeyLine = envExample.split(/\r?\n/).find((line) => /^OPENAI_API_KEY\s*=/.test(line.trim())) || ''
  const failures = []

  if (!/\/ai_recorder["']?/.test(envExample) && !/DATABASE_URL=.*ai_recorder/.test(envExample)) {
    failures.push('server/.env.example must default to ai_recorder')
  }
  if (!/WECHAT_APPID=["']?wxf73895336690e9a6["']?/.test(envExample)) {
    failures.push('server/.env.example must use AppID wxf73895336690e9a6')
  }
  if (!/MYSQL_DATABASE:\s*ai_recorder/.test(dockerCompose)) {
    failures.push('docker-compose.yml must create ai_recorder')
  }
  if (projectConfig.appid !== 'wxf73895336690e9a6') {
    failures.push('miniprogram/project.config.json must use AppID wxf73895336690e9a6')
  }
  if (!/^OPENAI_API_KEY\s*=\s*(?:""|''|)$/.test(openAiKeyLine.trim())) {
    failures.push('server/.env.example must keep OPENAI_API_KEY empty')
  }

  if (failures.length) {
    throw new Error(`Project boundary config failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('project boundary config is aligned\n')
}

function checkInitialMigrationBoundary() {
  process.stdout.write('\n> initial migration boundary scan\n')
  const migrationsDir = path.join(root, 'server', 'prisma', 'migrations')
  const initialMigrationName = '20260606000000_init_ai_recorder'
  const migrationNames = fs.readdirSync(migrationsDir)
    .filter((entry) => fs.statSync(path.join(migrationsDir, entry)).isDirectory())
    .filter((entry) => /^\d{14}_/.test(entry))
    .sort()
  const migrationPath = path.join(migrationsDir, initialMigrationName, 'migration.sql')
  const lockPath = path.join(migrationsDir, 'migration_lock.toml')
  const migrationSql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''
  const lockFile = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, 'utf8') : ''
  const requiredFamilyMemoryColumns = [
    'familyId',
    'scope',
    'memberId',
    'relatedMemberId',
    'summary',
    'avoidPhrases',
    'effectivePhrases',
    'sensitiveTopics',
    'status',
    'sourceMessageId',
    'sourceReplyId',
    'version',
    'createdAt',
    'updatedAt'
  ]
  const failures = []

  if (migrationNames[0] !== initialMigrationName) {
    failures.push('server/prisma/migrations must start from the ai_recorder initial migration')
  }
  if (!/provider\s*=\s*"mysql"/.test(lockFile)) {
    failures.push('migration_lock.toml must be locked to mysql')
  }
  if (!/CREATE TABLE `FamilyMemory`/.test(migrationSql)) {
    failures.push('initial migration must create FamilyMemory')
  }
  requiredFamilyMemoryColumns.forEach((column) => {
    if (!migrationSql.includes(`\`${column}\``)) {
      failures.push(`FamilyMemory migration must include ${column}`)
    }
  })
  migrationNames.forEach((migrationName) => {
    const sqlPath = path.join(migrationsDir, migrationName, 'migration.sql')
    if (!fs.existsSync(sqlPath)) {
      failures.push(`migration ${migrationName} must include migration.sql`)
      return
    }
    const sql = fs.readFileSync(sqlPath, 'utf8')
    if (/Class|Diary|Report|举报|班级|日记本|class_member/i.test(`${migrationName}\n${sql}`)) {
      failures.push(`migration ${migrationName} must not contain old class diary/report terms`)
    }
  })

  if (failures.length) {
    throw new Error(`Initial migration boundary failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('initial migration boundary is aligned\n')
}

function checkOldRuntimeTerms() {
  process.stdout.write('\n> old runtime keyword scan\n')
  const targets = [
    'miniprogram/app.json',
    'miniprogram/app.js',
    'miniprogram/pages',
    'miniprogram/services',
    'miniprogram/utils',
    'server/src/app.js',
    'server/src/routes',
    'server/src/controllers',
    'server/src/services',
    'server/prisma/schema.prisma',
    'server/package.json',
    'server/package-lock.json'
  ]
  const patterns = [
    /班级/g,
    /日记本/g,
    /举报/g,
    /classId/g,
    /currentClass/g,
    /CURRENT_CLASS/g,
    /\bdiary\b/gi,
    /\bcomment\b/gi,
    /\breport\b/gi
  ]
  const findings = []

  for (const target of targets) {
    const fullTarget = path.join(root, target)
    const files = fs.existsSync(fullTarget) && fs.statSync(fullTarget).isDirectory()
      ? walkFiles(fullTarget, () => true)
      : [fullTarget]

    for (const file of files) {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        continue
      }
      const content = fs.readFileSync(file, 'utf8')
      const lines = content.split(/\r?\n/)
      lines.forEach((line, index) => {
        if (patterns.some((pattern) => pattern.test(line))) {
          findings.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`)
        }
        patterns.forEach((pattern) => {
          pattern.lastIndex = 0
        })
      })
    }
  }

  if (findings.length) {
    throw new Error(`Old runtime terms found:\n${findings.join('\n')}`)
  }
  process.stdout.write('no old runtime terms matched\n')
}

function main() {
  checkJavaScriptSyntax()
  run('prisma validate', 'npx', ['prisma', 'validate', '--schema', 'prisma/schema.prisma'], { cwd: path.join(root, 'server') })
  run('prisma generate', 'npx', ['prisma', 'generate', '--schema', 'prisma/schema.prisma'], { cwd: path.join(root, 'server') })
  run('backend app load', 'node', ['-e', "require('./src/app'); console.log('app loaded')"], { cwd: path.join(root, 'server') })
  checkMiniProgramPages()
  checkProjectBoundaryConfig()
  checkInitialMigrationBoundary()
  checkOldRuntimeTerms()
  checkTrackedLocalArtifacts()
  checkTrackedSecrets()
  process.stdout.write('\nAll checks passed.\n')
}

try {
  main()
} catch (error) {
  process.stderr.write(`\n${error.message}\n`)
  process.exit(1)
}
