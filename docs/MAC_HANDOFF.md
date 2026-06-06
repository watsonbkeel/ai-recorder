# MAC_HANDOFF

This checklist is for moving the project to a Mac for WeChat DevTools, real AppID login, real audio behavior, and real AI provider testing.

## Project Boundaries

- Product name: 家庭 AI 留声机 / 暖心留声机.
- AppID: `wxf73895336690e9a6`.
- Default database: `ai_recorder`.
- No report/举报 feature.
- The old class diary project is only a code template. Do not share database data, users, uploads, migrations, API routes, frontend entries, admin workflows, or AI memory with it.
- Secrets must stay in ignored local files such as `server/.env`.

## Backend Setup

1. Start MySQL:

```bash
docker compose up -d mysql
```

2. Configure and start the backend:

```bash
cd server
cp .env.example .env
npm install
npx prisma generate --schema prisma/schema.prisma
npx prisma migrate dev
npm run dev
```

3. Check the backend:

```bash
curl http://127.0.0.1:3000/health
```

Expected response contains `ok: true`.

## Local Environment Values

Set these in `server/.env` only:

```env
DATABASE_URL="mysql://ai_recorder_user:ai_recorder_password_change_me@127.0.0.1:3306/ai_recorder"
WECHAT_APPID="wxf73895336690e9a6"
WECHAT_SECRET="your_real_wechat_secret"
OPENAI_API_KEY="your_real_ai_provider_key"
OPENAI_BASE_URL="https://token.bkeel.com/v1"
OPENAI_MODEL="gpt-5.4-mini"
UPLOAD_DIR="./uploads/ai-recorder"
PUBLIC_BASE_URL="http://127.0.0.1:3000"
```

Do not commit `.env`, WeChat secrets, GitHub tokens, AI provider keys, local uploads, logs, or WeChat private config.

## Mini Program Setup

1. Open `miniprogram/` in WeChat DevTools.
2. Confirm the project AppID is `wxf73895336690e9a6`.
3. For simulator-only local backend testing, run this in the DevTools console:

```js
wx.setStorageSync('AI_RECORDER_LOCAL_CONFIG', {
  PUBLIC_BASE_URL: 'http://127.0.0.1:3000',
  API_BASE_URL: 'http://127.0.0.1:3000/api'
})
```

4. For real phone preview, replace `127.0.0.1` with the Mac LAN IP.
5. During local HTTP testing, enable the DevTools option that skips legal domain, web-view, TLS version, and HTTPS certificate checks.
6. Do not edit tracked `miniprogram/utils/config.js` for local testing.

Clear the local override after testing:

```js
wx.removeStorageSync('AI_RECORDER_LOCAL_CONFIG')
```

## Mac Acceptance Checks

- `npm run smoke:core` passes after MySQL is running and Prisma migrations are applied; this includes identity normalization, message visibility, original audio privacy, family memory refresh/privacy, AI context, and admin permission checks.
- `npm run check` passes from the repository root.
- WeChat login works after a real `WECHAT_SECRET` is configured.
- Account/password login and registration still work as the local fallback.
- User can create a family and fill identity fields.
- User can join by invite code and submit relationship, gender, child order, birth year, family nickname, preferred title, and identity note.
- Admin can approve join requests and edit member identity.
- User can create text-only messages without AI.
- User can record, preview, upload, and send voice messages.
- Original audio can be played only through the authenticated message audio endpoint.
- AI message optimization, message analysis, and reply optimization work with family memory on and off.
- `useFamilyMemory: false` skips family memory context.
- Deleting or hiding messages/replies makes related family memory stale.
- Notification links handle deleted/hidden content without exposing unavailable messages.
- User-visible pages do not show class diary or report workflow copy.

## Final Before Push

Run:

```bash
npm run check
git status --short
```

The repository should have no tracked secrets and no local runtime artifacts.
