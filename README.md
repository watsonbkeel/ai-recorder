# 暖心留声机

家庭 AI 留声机微信小程序。它帮助家庭成员用文字和语音留下心声，并通过 AI 把不好开口、表述混乱或容易激化矛盾的话整理成更清楚、更温和、更容易被家人理解的表达。

## 关键边界

- 默认数据库：`ai_recorder`
- 小程序 AppID：`wxf73895336690e9a6`
- 旧项目只作为代码模板，不共享运行数据、用户身份、上传文件、迁移历史、前端入口、管理流程、API 或 AI 记忆。
- 没有举报功能。
- 密钥只放本地 `server/.env`，不能提交。

## 当前能力

- 微信登录/注册，账号密码登录作为本地调试和兜底。
- 创建家庭、邀请码加入、管理员审核。
- 设置家庭身份：父母/子女/其他关系、性别、子女排行、出生年份、家庭昵称、希望被称呼、身份备注。
- 给指定家人、全家或仅自己发送/保存文字和语音留言；只录语音时也可以手动填写给家人先看到的整理版。
- AI 理解留言，并整理留言和回复。
- 发送者控制原始文字和原始语音是否开放给接收人。
- 家庭沟通记忆：在当前家庭内记录沟通偏好、敏感点、避免话术和有效话术，可由用户关闭。
- 家庭管理：入家申请、成员管理、成员身份编辑、停用留言、隐藏留言/回复。
- 通知中心可打开留言，也可直达入家申请审核页。

## 本地启动

```bash
docker compose up -d mysql

cd server
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

小程序使用微信开发者工具打开 `miniprogram/`。

如果在 Mac 上本地联调，把 `miniprogram/utils/config.js` 里的 `PUBLIC_BASE_URL` 和 `API_BASE_URL` 改成你的本机或局域网后端地址，例如 `http://127.0.0.1:3000` 和 `http://127.0.0.1:3000/api`。生产环境再改回正式 HTTPS 域名。

微信登录需要在本地 `server/.env` 配置 `WECHAT_APPID` 和 `WECHAT_SECRET`。真实 `WECHAT_SECRET` 不能提交到仓库。

## 文档

- `AGENTS.md`: 开发代理约束。
- `docs/API_SPEC.md`: API 规格。
- `docs/AI_CONSTRAINTS.md`: AI 和家庭记忆约束。
- `docs/DATABASE_SCHEMA.md`: 数据库模型。
- `docs/PERMISSION_MODEL.md`: 权限和隐私规则。
- `docs/UX_FLOW.md`: 小程序流程。
- `docs/TEST_PLAN.md`: 验收测试。
