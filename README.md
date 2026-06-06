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

如果在 Mac 上本地联调，不要修改已跟踪的 `miniprogram/utils/config.js`。在微信开发者工具控制台设置本地覆盖：

```js
wx.setStorageSync('AI_RECORDER_LOCAL_CONFIG', {
  PUBLIC_BASE_URL: 'http://127.0.0.1:3000',
  API_BASE_URL: 'http://127.0.0.1:3000/api'
})
```

如果用真机预览，把地址改成 Mac 的局域网 IP，并在开发者工具里开启“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。清除本地覆盖可执行：

```js
wx.removeStorageSync('AI_RECORDER_LOCAL_CONFIG')
```

正式提交仍保留 `config.js` 里的 HTTPS 默认域名。

微信登录需要在本地 `server/.env` 配置 `WECHAT_APPID` 和 `WECHAT_SECRET`。真实 `WECHAT_SECRET` 不能提交到仓库。

AI 留言处理默认使用 OpenAI 兼容接口 `https://token.bkeel.com/v1` 和模型 `gpt-5.4-mini`。真实 `OPENAI_API_KEY` 只能放在本地 `server/.env`，不能提交。

迁移到 Mac 后可在仓库根目录运行：

```bash
npm run check
```

这个检查会覆盖 JS 语法、Prisma schema/generate、后端 app 加载、小程序页面清单、旧项目运行残留和已跟踪文件密钥扫描。

数据库启动并完成迁移后，可运行核心业务烟测：

```bash
npm run smoke:core
```

这个烟测会创建临时账号和家庭，覆盖入家审批、身份归一、留言范围、回复、原始音频隐私、家庭沟通记忆、AI 上下文、管理权限、通知过滤、隐藏内容和移除成员，结束后清理测试数据。

## 文档

- `AGENTS.md`: 开发代理约束。
- `docs/API_SPEC.md`: API 规格。
- `docs/AI_CONSTRAINTS.md`: AI 和家庭记忆约束。
- `docs/DATABASE_SCHEMA.md`: 数据库模型。
- `docs/FRONTEND_DESIGN.md`: 基于 loading 图的前端视觉规范。
- `docs/MAC_HANDOFF.md`: Mac/微信开发者工具真实联调交接清单。
- `docs/PERMISSION_MODEL.md`: 权限和隐私规则。
- `docs/UX_FLOW.md`: 小程序流程。
- `docs/TEST_PLAN.md`: 验收测试。
