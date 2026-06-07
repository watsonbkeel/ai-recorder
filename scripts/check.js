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
  const refreshConfigFailures = []

  for (const page of appJson.pages || []) {
    for (const ext of ['js', 'wxml', 'wxss', 'json']) {
      const file = path.join(root, 'miniprogram', `${page}.${ext}`)
      if (!fs.existsSync(file)) {
        missing.push(path.relative(root, file))
      }
    }

    const jsPath = path.join(root, 'miniprogram', `${page}.js`)
    const jsonPath = path.join(root, 'miniprogram', `${page}.json`)
    if (fs.existsSync(jsPath) && fs.existsSync(jsonPath)) {
      const jsContent = fs.readFileSync(jsPath, 'utf8')
      const pageJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      if (/onPullDownRefresh\s*\(/.test(jsContent) && pageJson.enablePullDownRefresh !== true) {
        refreshConfigFailures.push(`${page}.json must enablePullDownRefresh because ${page}.js implements onPullDownRefresh`)
      }
    }
  }

  if (missing.length) {
    throw new Error(`Missing mini program page files:\n${missing.join('\n')}`)
  }
  if (refreshConfigFailures.length) {
    throw new Error(`Mini program refresh config failures:\n${refreshConfigFailures.join('\n')}`)
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
    ['github_token_like', /ghp_[A-Za-z0-9_]+/g],
    ['github_token_like', /github_pat_[A-Za-z0-9_]+/g],
    ['ai_key_like', /sk-[A-Za-z0-9]{20,}/g],
    ['ai_key_env_like', /OPENAI_API_KEY\s*=\s*["']?(sk-[A-Za-z0-9]{20,})/g],
    ['wechat_appid_like', /wx[0-9a-fA-F]{16}/g]
  ]
  const findings = []

  for (const file of gitTrackedFiles()) {
    const fullPath = path.join(root, file)
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      continue
    }
    const content = fs.readFileSync(fullPath, 'utf8')
    secretPatterns.forEach(([label, pattern]) => {
      if (file === 'scripts/check.js' && label === 'wechat_appid_like') {
        return
      }
      const matches = content.match(pattern)
      if (matches) {
        findings.push(`${file}: ${label}`)
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
  const wechatAppIdLine = envExample.split(/\r?\n/).find((line) => /^WECHAT_APPID\s*=/.test(line.trim())) || ''
  const failures = []

  if (!/\/ai_recorder["']?/.test(envExample) && !/DATABASE_URL=.*ai_recorder/.test(envExample)) {
    failures.push('server/.env.example must default to ai_recorder')
  }
  if (!/^WECHAT_APPID\s*=\s*(?:""|''|)$/.test(wechatAppIdLine.trim())) {
    failures.push('server/.env.example must keep WECHAT_APPID empty')
  }
  if (!/MYSQL_DATABASE:\s*ai_recorder/.test(dockerCompose)) {
    failures.push('docker-compose.yml must create ai_recorder')
  }
  if (!/127\.0\.0\.1:13306:3306/.test(dockerCompose)) {
    failures.push('docker-compose.yml must bind ai_recorder MySQL to 127.0.0.1:13306 to avoid the old diary database on 3306')
  }
  if (/127\.0\.0\.1:3306\/ai_recorder/.test(envExample)) {
    failures.push('server/.env.example must not point ai_recorder at local 3306, which is reserved for the old diary database')
  }
  if (projectConfig.appid !== 'touristappid') {
    failures.push('miniprogram/project.config.json must use touristappid placeholder')
  }
  if (!/^OPENAI_API_KEY\s*=\s*(?:""|''|)$/.test(openAiKeyLine.trim())) {
    failures.push('server/.env.example must keep OPENAI_API_KEY empty')
  }

  if (failures.length) {
    throw new Error(`Project boundary config failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('project boundary config is aligned\n')
}

function checkMiniProgramPrivacyConfig() {
  process.stdout.write('\n> mini program privacy config scan\n')
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram', 'app.json'), 'utf8'))
  const sitemap = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram', 'sitemap.json'), 'utf8'))
  const failures = []

  if (appJson.sitemapLocation !== 'sitemap.json') {
    failures.push('miniprogram/app.json must point to sitemap.json')
  }

  const rules = Array.isArray(sitemap.rules) ? sitemap.rules : []
  const hasGlobalDisallow = rules.some((rule) => rule && rule.action === 'disallow' && rule.page === '*')
  const hasAllowRule = rules.some((rule) => rule && rule.action === 'allow')
  if (!hasGlobalDisallow || hasAllowRule) {
    failures.push('miniprogram/sitemap.json must disallow indexing for private family pages')
  }

  if (failures.length) {
    throw new Error(`Mini program privacy config failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('mini program privacy config is aligned\n')
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

function checkMiniProgramStructuredIoErrors() {
  process.stdout.write('\n> mini program structured IO error scan\n')
  const files = [
    'miniprogram/services/upload.js',
    'miniprogram/services/message.js'
  ]
  const failures = []

  files.forEach((file) => {
    const content = fs.readFileSync(path.join(root, file), 'utf8')
    if (!content.includes('buildRequestError')) {
      failures.push(`${file} must build errors with request.buildRequestError`)
    }
    if (/reject\(\s*new Error\(/.test(content)) {
      failures.push(`${file} must not reject plain Error objects from upload/download flows`)
    }
  })

  const messageService = fs.readFileSync(path.join(root, 'miniprogram', 'services', 'message.js'), 'utf8')
  const detailPage = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-detail', 'message-detail.js'), 'utf8')
  if (!/readDownloadErrorBody/.test(messageService) || !/data\.error/.test(messageService)) {
    failures.push('message download must parse backend error bodies for original audio permission failures')
  }
  if (!/playOriginalAudio[\s\S]*handleFamilyAccessError/.test(detailPage)) {
    failures.push('message detail original audio playback must handle family access errors')
  }

  if (failures.length) {
    throw new Error(`Mini program structured IO error failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('mini program IO errors are structured\n')
}

function checkBackendErrorPrivacy() {
  process.stdout.write('\n> backend error privacy scan\n')
  const errorHandler = fs.readFileSync(path.join(root, 'server', 'src', 'middleware', 'errorHandler.js'), 'utf8')
  const failures = []

  if (!/function redactLogMessage\(value\)/.test(errorHandler)) {
    failures.push('backend should redact unexpected internal error log messages')
  }
  ;[
    'REDACTED_GITHUB_TOKEN',
    'REDACTED_AI_KEY',
    'REDACTED_WECHAT_APPID'
  ].forEach((marker) => {
    if (!errorHandler.includes(marker)) {
      failures.push(`backend error log redaction must include ${marker}`)
    }
  })
  if (!/console\.error\('\[internal-error\]', redactLogMessage\(error\.message\)\)/.test(errorHandler)) {
    failures.push('backend should log unexpected internal errors only after redaction')
  }
  if (/code:\s*'INTERNAL_ERROR'[\s\S]*message:\s*error\.message/.test(errorHandler)) {
    failures.push('backend must not expose unexpected error.message in INTERNAL_ERROR responses')
  }
  if (!/code:\s*'INTERNAL_ERROR'[\s\S]*message:\s*'服务器内部错误'/.test(errorHandler)) {
    failures.push('backend must return a stable generic INTERNAL_ERROR message')
  }

  if (failures.length) {
    throw new Error(`Backend error privacy failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('backend error privacy is aligned\n')
}

function checkUploadPrivacyBoundaries() {
  process.stdout.write('\n> upload privacy boundary scan\n')
  const appJs = fs.readFileSync(path.join(root, 'server', 'src', 'app.js'), 'utf8')
  const uploadService = fs.readFileSync(path.join(root, 'server', 'src', 'services', 'upload.service.js'), 'utf8')
  const messageService = fs.readFileSync(path.join(root, 'server', 'src', 'services', 'message.service.js'), 'utf8')
  const miniMessageService = fs.readFileSync(path.join(root, 'miniprogram', 'services', 'message.js'), 'utf8')
  const detailPage = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-detail', 'message-detail.js'), 'utf8')
  const failures = []

  if (!/app\.use\('\/uploads\/image'/.test(appJs)) {
    failures.push('backend must expose uploaded images only under /uploads/image')
  }
  if (/app\.use\('\/uploads'\s*,|app\.use\('\/uploads\/audio'/.test(appJs)) {
    failures.push('backend must not statically expose /uploads or /uploads/audio')
  }
  if (!/async function uploadAudio[\s\S]*return \{[\s\S]*url: relativePath[\s\S]*\}/.test(uploadService)) {
    failures.push('audio upload must return only the storage url')
  }
  if (/async function uploadAudio[\s\S]*fullUrl/.test(uploadService)) {
    failures.push('audio upload must not return a public fullUrl')
  }
  if (!/originalAudioUrl: canPlayOriginalAudio && message\.originalAudioUrl \? `\/api\/messages\/\$\{message\.id\}\/original-audio` : null/.test(messageService)) {
    failures.push('message reads must expose original audio only as authenticated playback endpoints')
  }
  if (!/function downloadOriginalAudio\(originalAudioUrl\)/.test(miniMessageService) || !/Authorization: `Bearer \$\{token\}`/.test(miniMessageService)) {
    failures.push('mini program original audio download must include auth token')
  }
  if (!/playOriginalAudio[\s\S]*messageService\.downloadOriginalAudio/.test(detailPage)) {
    failures.push('message detail page must play original audio through messageService.downloadOriginalAudio')
  }

  if (failures.length) {
    throw new Error(`Upload privacy boundary failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('upload privacy boundaries are aligned\n')
}

function checkMiniProgramFamilyAccessHandling() {
  process.stdout.write('\n> mini program family access handling scan\n')
  const pages = [
    'miniprogram/pages/message-list/message-list.js',
    'miniprogram/pages/message-create/message-create.js',
    'miniprogram/pages/message-detail/message-detail.js',
    'miniprogram/pages/profile/profile.js',
    'miniprogram/pages/admin/dashboard/dashboard.js',
    'miniprogram/pages/admin/join-requests/join-requests.js',
    'miniprogram/pages/admin/members/members.js'
  ]
  const failures = []

  pages.forEach((file) => {
    const content = fs.readFileSync(path.join(root, file), 'utf8')
    if (!content.includes('handleFamilyAccessError')) {
      failures.push(`${file} must use shared family access error handling`)
    }
    if (/FAMILY_CONTEXT_ERROR_CODES|new Set\(\s*\[\s*['"]NOT_FAMILY_MEMBER['"]/.test(content)) {
      failures.push(`${file} must not maintain local family access error code sets`)
    }
  })

  const messageList = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-list', 'message-list.js'), 'utf8')
  if (!/loadMore[\s\S]*handleFamilyAccessError/.test(messageList)) {
    failures.push('message list loadMore must handle family access errors')
  }
  if (!/const familyService = require\('\.\.\/\.\.\/services\/family'\)/.test(messageList) || !/async syncCurrentFamily\(\)/.test(messageList)) {
    failures.push('message list must sync URL-selected family with local storage before loading')
  }
  if (!/families\.find\(\(family\) => Number\(family\.id\) === requestedFamilyId\)/.test(messageList)) {
    failures.push('message list must match URL-selected family IDs numerically when syncing local storage')
  }

  const messageCreate = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-create', 'message-create.js'), 'utf8')
  ;['loadMembers', 'optimize', 'submit'].forEach((methodName) => {
    const pattern = new RegExp(`${methodName}[\\s\\S]*handleFamilyAccessError`)
    if (!pattern.test(messageCreate)) {
      failures.push(`message create ${methodName} must handle family access errors`)
    }
  })

  const profile = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'profile', 'profile.js'), 'utf8')
  if (!/saveIdentity[\s\S]*handleFamilyAccessError/.test(profile)) {
    failures.push('profile saveIdentity must handle family access errors')
  }

  const adminMembersJs = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'admin', 'members', 'members.js'), 'utf8')
  const adminMembersWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'admin', 'members', 'members.wxml'), 'utf8')
  ;['toggleMute', 'toggleRole', 'removeMember'].forEach((methodName) => {
    const pattern = new RegExp(`${methodName}[\\s\\S]*item && item\\.isSelf`)
    if (!pattern.test(adminMembersJs)) {
      failures.push(`admin members ${methodName} must guard self-management actions`)
    }
  })
  const selfHiddenActionCount = (adminMembersWxml.match(/wx:if="\{\{!item\.isSelf\}\}"/g) || []).length
  if (selfHiddenActionCount < 3) {
    failures.push('admin members page must hide mute, role, and remove actions for the current member')
  }

  const familyClient = fs.readFileSync(path.join(root, 'miniprogram', 'services', 'family.js'), 'utf8')
  if (!/encodeURIComponent\(String\(inviteCode \|\| ''\)\.trim\(\)\)/.test(familyClient)) {
    failures.push('family invite lookup must trim and encode invite codes before building the URL')
  }

  if (failures.length) {
    throw new Error(`Mini program family access handling failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('mini program family access handling is aligned\n')
}

function checkMiniProgramAiSafetyUi() {
  process.stdout.write('\n> mini program AI safety UI scan\n')
  const messageCreateWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-create', 'message-create.wxml'), 'utf8')
  const messageDetailWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-detail', 'message-detail.wxml'), 'utf8')
  const appWxss = fs.readFileSync(path.join(root, 'miniprogram', 'app.wxss'), 'utf8')
  const failures = []

  if (!/attackWarning/.test(messageCreateWxml) || !/riskLevel\s*===\s*'high'/.test(messageCreateWxml) || !/risk-panel/.test(messageCreateWxml)) {
    failures.push('message create page must show AI riskLevel and attackWarning before sending')
  }
  if ((messageDetailWxml.match(/risk-panel/g) || []).length < 3) {
    failures.push('message detail page must show safety reminders for messages, analysis, and replies')
  }
  if (!/message\.attackWarning/.test(messageDetailWxml) || !/item\.attackWarning/.test(messageDetailWxml) || !/analysis\.riskLevel\s*===\s*'high'/.test(messageDetailWxml)) {
    failures.push('message detail page must expose message, reply, and analysis AI safety signals')
  }
  if (!/\.risk-panel/.test(appWxss) || !/\.risk-title/.test(appWxss) || !/\.risk-text/.test(appWxss)) {
    failures.push('global mini program styles must include warm safety reminder styles')
  }

  if (failures.length) {
    throw new Error(`Mini program AI safety UI failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('mini program AI safety UI is aligned\n')
}

function checkMiniProgramIdentityDisplay() {
  process.stdout.write('\n> mini program family identity display scan\n')
  const messageListJs = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-list', 'message-list.js'), 'utf8')
  const messageListWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-list', 'message-list.wxml'), 'utf8')
  const messageDetailJs = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-detail', 'message-detail.js'), 'utf8')
  const messageDetailWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-detail', 'message-detail.wxml'), 'utf8')
  const failures = []

  if (!/identitySummary/.test(messageListJs) || !/senderIdentitySummary/.test(messageListJs)) {
    failures.push('message list must derive sender family identity summaries')
  }
  if (!/家庭身份：\{\{item\.senderIdentitySummary\}\}/.test(messageListWxml)) {
    failures.push('message list must display sender family identity')
  }
  if (!/identitySummary/.test(messageDetailJs) || (messageDetailJs.match(/senderIdentitySummary/g) || []).length < 2) {
    failures.push('message detail must derive family identity summaries for messages and replies')
  }
  if (!/家庭身份：\{\{message\.senderIdentitySummary\}\}/.test(messageDetailWxml) || !/家庭身份：\{\{item\.senderIdentitySummary\}\}/.test(messageDetailWxml)) {
    failures.push('message detail must display family identity for messages and replies')
  }

  if (failures.length) {
    throw new Error(`Mini program family identity display failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('mini program family identity display is aligned\n')
}

function checkMiniProgramMessageCreateGuards() {
  process.stdout.write('\n> mini program message create guard scan\n')
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram', 'app.json'), 'utf8'))
  const messageCreateJs = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-create', 'message-create.js'), 'utf8')
  const messageCreateWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-create', 'message-create.wxml'), 'utf8')
  const failures = []

  if (!/async optimize\(\)[\s\S]*const visibility = VISIBILITIES\[this\.data\.visibilityIndex\][\s\S]*const receiverIds = this\.effectiveReceiverIds\(\)[\s\S]*visibility === 'private' && !receiverIds\.length/.test(messageCreateJs)) {
    failures.push('message create AI optimization must require selected receivers for private messages')
  }
  if (!/recording: true, audioTempPath: '', audioDurationSec: 0, allowOriginalAudioPlay: false/.test(messageCreateJs)) {
    failures.push('message create must clear original audio permission when replacing a recording')
  }
  if (!/allowOriginalAudioPlay: Boolean\(this\.data\.audioTempPath\) && this\.data\.allowOriginalAudioPlay/.test(messageCreateJs)) {
    failures.push('message create submit must only send original audio permission when an audio file exists')
  }
  if (!/wx:if="\{\{visibilityIndex !== 2 && audioTempPath\}\}"/.test(messageCreateWxml)) {
    failures.push('message create page must hide original audio permission unless audio exists')
  }
  if (!appJson.permission || !appJson.permission['scope.record'] || !appJson.permission['scope.record'].desc) {
    failures.push('miniprogram/app.json must declare scope.record permission purpose for voice messages')
  }
  if (!/async ensureRecordPermission\(\)/.test(messageCreateJs) || !/requestOpenRecordSetting/.test(messageCreateJs) || !/wx\.authorize\(\{[\s\S]*scope: 'scope\.record'/.test(messageCreateJs) || !/wx\.openSetting/.test(messageCreateJs)) {
    failures.push('message create page must request record permission and guide denied users to settings')
  }
  if (!/async startRecord\(\)[\s\S]*const hasPermission = await this\.ensureRecordPermission\(\)[\s\S]*if \(!hasPermission\)[\s\S]*recorder\.start/.test(messageCreateJs)) {
    failures.push('message create startRecord must confirm record permission before starting the recorder')
  }

  if (failures.length) {
    throw new Error(`Mini program message create guard failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('mini program message create guards are aligned\n')
}

function checkSelfMessageReplyBoundary() {
  process.stdout.write('\n> self message reply boundary scan\n')
  const replyService = fs.readFileSync(path.join(root, 'server', 'src', 'services', 'reply.service.js'), 'utf8')
  const aiService = fs.readFileSync(path.join(root, 'server', 'src', 'services', 'ai.service.js'), 'utf8')
  const messageDetailWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'message-detail', 'message-detail.wxml'), 'utf8')
  const smoke = fs.readFileSync(path.join(root, 'scripts', 'smoke-core.js'), 'utf8')
  const failures = []

  if (!/message\.visibility === 'self'[\s\S]*仅自己留言不需要回复/.test(replyService)) {
    failures.push('backend reply service must reject replies for self-only messages')
  }
  if (!/visibility: message\.visibility/.test(aiService) || !/options\.rejectSelfReply && message\.visibility === 'self'[\s\S]*仅自己留言不需要回复/.test(aiService) || !/loadMessageContext\(userId, payload\.messageId, payload, \{ rejectSelfReply: true \}\)/.test(aiService)) {
    failures.push('backend AI reply optimization must know message visibility and reject self-only messages before building reply context')
  }
  if (!/wx:if="\{\{message\.visibility !== 'self'\}\}"[\s\S]*回复家人/.test(messageDetailWxml) || !/wx:else[\s\S]*自留心声[\s\S]*不需要回复/.test(messageDetailWxml)) {
    failures.push('message detail page must hide reply composer for self-only messages and explain the self note state')
  }
  if (!/self message should not accept replies/.test(smoke) || !/self message should not accept AI reply optimization/.test(smoke)) {
    failures.push('core smoke must cover self-only message reply rejection')
  }

  if (failures.length) {
    throw new Error(`Self message reply boundary failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('self message reply boundary is aligned\n')
}

function checkMiniProgramAdminPageGuards() {
  process.stdout.write('\n> mini program admin page guard scan\n')
  const adminPages = [
    'miniprogram/pages/admin/dashboard/dashboard',
    'miniprogram/pages/admin/join-requests/join-requests',
    'miniprogram/pages/admin/members/members'
  ]
  const failures = []

  adminPages.forEach((page) => {
    const js = fs.readFileSync(path.join(root, `${page}.js`), 'utf8')
    const pageJson = JSON.parse(fs.readFileSync(path.join(root, `${page}.json`), 'utf8'))
    if (!/auth\.getCurrentFamily\(\)/.test(js)) {
      failures.push(`${page}.js must fall back to the locally selected family`)
    }
    if (!/请先选择家庭/.test(js)) {
      failures.push(`${page}.js must show a clear missing-family state`)
    }
    if (!/wx\.stopPullDownRefresh\(\)/.test(js)) {
      failures.push(`${page}.js must stop pull-down refresh after loading`)
    }
    if (pageJson.enablePullDownRefresh !== true) {
      failures.push(`${page}.json must enable pull-down refresh`)
    }
  })

  if (failures.length) {
    throw new Error(`Mini program admin page guard failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('mini program admin page guards are aligned\n')
}

function checkMiniProgramNotificationNavigation() {
  process.stdout.write('\n> mini program notification navigation scan\n')
  const notificationsJs = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'notifications', 'notifications.js'), 'utf8')
  const notificationsJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'notifications', 'notifications.json'), 'utf8'))
  const failures = []

  if (notificationsJson.enablePullDownRefresh !== true) {
    failures.push('notifications page must enable pull-down refresh')
  }
  if (!/async syncCurrentFamily\(familyId\)/.test(notificationsJs) || !/auth\.setCurrentFamily\(matchedFamily\)/.test(notificationsJs)) {
    failures.push('notifications page must sync the locally selected family before family-scoped navigation')
  }
  if (!/if \(item\.messageId\)[\s\S]*const familyId = item\.familyId \? Number\(item\.familyId\) : null[\s\S]*await this\.syncCurrentFamily\(familyId\)[\s\S]*message-detail/.test(notificationsJs)) {
    failures.push('message notifications must sync current family before opening message detail')
  }
  if (!/family_join_requested[\s\S]*await this\.syncCurrentFamily\(item\.familyId\)[\s\S]*join-requests/.test(notificationsJs)) {
    failures.push('join request notifications must sync current family before opening admin review')
  }
  if (!/join_request_approved[\s\S]*await this\.enterApprovedFamily\(item\.familyId\)/.test(notificationsJs)) {
    failures.push('join approval notifications must enter the approved family through the shared sync flow')
  }

  if (failures.length) {
    throw new Error(`Mini program notification navigation failures:\n${failures.join('\n')}`)
  }
  process.stdout.write('mini program notification navigation is aligned\n')
}

function main() {
  checkJavaScriptSyntax()
  run('prisma validate', 'npx', ['prisma', 'validate', '--schema', 'prisma/schema.prisma'], { cwd: path.join(root, 'server') })
  run('prisma generate', 'npx', ['prisma', 'generate', '--schema', 'prisma/schema.prisma'], { cwd: path.join(root, 'server') })
  run('backend app load', 'node', ['-e', "require('./src/app'); console.log('app loaded')"], { cwd: path.join(root, 'server') })
  checkMiniProgramPages()
  checkProjectBoundaryConfig()
  checkMiniProgramPrivacyConfig()
  checkInitialMigrationBoundary()
  checkOldRuntimeTerms()
  checkMiniProgramStructuredIoErrors()
  checkBackendErrorPrivacy()
  checkUploadPrivacyBoundaries()
  checkMiniProgramFamilyAccessHandling()
  checkMiniProgramAiSafetyUi()
  checkMiniProgramIdentityDisplay()
  checkMiniProgramMessageCreateGuards()
  checkSelfMessageReplyBoundary()
  checkMiniProgramAdminPageGuards()
  checkMiniProgramNotificationNavigation()
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
