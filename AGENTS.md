# AGENTS.md

## Product Mission

本项目是家庭 AI 留声机 / 暖心留声机微信小程序。目标是帮助家庭成员把不容易说出口的话更清楚、温和、真实地传达给家人，推动家庭和谐沟通。

AI 的角色是家庭沟通表达助手：整理表达、提炼情绪和需要、提示更有效的话术。AI 不能做裁判、心理诊断、人格判断、道德审判，也不能替用户编造事实、道歉、承诺或爱意。

## Hard Boundaries

- 旧项目只能作为代码模板来源。
- 新项目不得共享旧项目的运行数据、用户身份、上传文件、迁移历史、前端入口、管理流程、API 或 AI 记忆。
- 默认数据库是 `ai_recorder`。
- 微信小程序 AppID 是 `wxf`。
- 没有举报功能。家庭管理只保留入家申请、成员管理、停用留言、隐藏留言/回复等基础能力。
- 密钥只能放在被 git 忽略的本地 `server/.env`，不能提交到仓库。
- OpenAI 兼容服务配置必须通过环境变量读取，不得硬编码真实 key。

## Technical Stack

- Frontend: native WeChat mini program, JavaScript, WXML, WXSS.
- Backend: Node.js, Express, Prisma, MySQL 8.0, JWT, Multer, axios.
- Infrastructure: Docker Compose local MySQL.
- Avoid introducing a new frontend/backend framework unless the user explicitly asks.

## Core Domain

- `Family`: 家庭空间。
- `FamilyMember`: 家庭成员和家庭内身份。
- `FamilyMessage`: 给家人的留言/心声。
- `FamilyMessageReceiver`: 留言接收人和阅读/回复状态。
- `FamilyReply`: 家庭回复。
- `FamilyMemory`: 家庭沟通记忆。

Family member identity must support relationship, gender, child order, birth year, family nickname, preferred title, and identity note. Multiple children must be distinguishable by rank and gender when the family sets those fields.

Message visibility supports `private` (指定家人), `family` (全家可见), and `self` (仅自己). Backend services must enforce these scopes and must not rely on frontend receiver lists for full-family coverage.

## Family Memory Rules

- `FamilyMemory` supports `family`, `member`, and `pair` scopes.
- Family memory is only available inside the current family.
- It must never cross families, projects, databases, users, uploads, migrations, frontend entries, admin flows, APIs, or AI memories from the old project.
- AI may use memory only when the user leaves `useFamilyMemory` enabled.
- If `useFamilyMemory: false`, backend AI code must not query or inject `FamilyMemory`.
- Memory may summarize communication preferences, sensitive topics, avoid phrases, and effective phrases.
- Memory must not summarize personality labels, mental health diagnoses, moral judgments, or fixed character conclusions.
- Deleting or hiding messages/replies must mark related family memories stale or trigger recomputation.
- Memory refresh failure must be logged and must not block message or reply creation.

## AI Context Rules

- AI context is built only by the backend.
- Frontend must not supply arbitrary history, family memory, or message context for the model.
- For existing content, backend must verify the current user is an approved member of the current family and can view that message/reply.
- AI context may include identities, optimized text, visible recent summaries, avoid phrases, effective phrases, sensitive topics, and sender/receiver relationship metadata.
- Sender-hidden original text and original audio must not enter AI context.
- AI prompts may use family identity for称呼、语气、边界表达, but must avoid gender, age, rank, or role stereotypes.

## Product Principles

- Preserve the user's real intent and real emotion.
- Make expression easier to understand without erasing boundaries.
- Promote harmony through listening, repair, respect, and clarity, not through one-sided tolerance.
- Do not encourage users to endure abuse, coercion, humiliation, threats, or emotional blackmail.
- High-risk content must prioritize safety guidance over warm rewriting.

## Development Rules

- Keep the app runnable end to end.
- Prefer existing project patterns and simple Express/Prisma service boundaries.
- Keep permission checks close to the service operations that read/write data.
- Keep user-facing copy in family / 留声 / 留言 / 暖心表达 language.
- Do not reintroduce old class, diary, comment, like, or report runtime routes/pages/services.
- Do not commit `.env`, secrets, runtime uploads, logs, pid files, `node_modules`, WeChat private project config, `.DS_Store`, or `._*` metadata.

## GitHub

- Remote: `https://github.com/watsonbkeel/ai-recorder`
- Default branch: `main`
- Commit source and docs together when the docs describe the behavior being changed.
