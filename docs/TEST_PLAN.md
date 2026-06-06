# TEST_PLAN

## Backend Setup

1. Start MySQL:

```bash
docker compose up -d mysql
```

2. Initialize backend:

```bash
cd server
npm install
cp .env.example .env
npx prisma generate --schema prisma/schema.prisma
npx prisma migrate dev
npm run dev
```

3. Check health:

```bash
curl http://127.0.0.1:3000/health
```

## Configuration Checks

- `DATABASE_URL` uses `ai_recorder`.
- `WECHAT_APPID` is `wxf73895336690e9a6`.
- `WECHAT_SECRET` is configured only in ignored local `server/.env` before testing real WeChat login.
- AI provider values are read from ignored `server/.env`.
- No real GitHub PAT, AI key, or provider secret is tracked.

## Mini Program Checks

- Login page appears by default.
- User can sign in with WeChat login when `WECHAT_SECRET` is configured.
- New user can register with account name, password, and nickname.
- Existing user can log in.
- User enters family selection after login.
- User can create a family and set family identity.
- User can request to join by invite code and submit family identity.
- Admin can approve the request and see applicant identity.
- Approved member can enter the family timeline.

## Identity Checks

- Relationship can be set to parent, child, partner, sibling, elder, or other.
- Gender can be set or left unspecified.
- Multiple children can be distinguished by `childOrder`.
- Birth year, family nickname, preferred title, and identity note can be saved and later edited.
- Admin can edit a member's family identity from member management.
- AI uses identity only for称呼、语气 and表达适配, not stereotypes.

## Message Checks

- User can select receiver(s) from family members.
- User can enter original text.
- User can record and upload original voice.
- Voice-only messages can be sent after the user manually fills the expression family members should read first.
- AI can generate optimized text, emotion tags, core need, advice, and risk level.
- User can disable family memory before AI optimization.
- Sender can choose whether original text is visible.
- Sender can choose whether original audio is playable.
- Receiver sees AI optimized text first.
- Receiver can only view/play original content when authorized.
- Receiver can ask AI to understand the message with family memory on/off.
- Receiver can use AI assisted reply with family memory on/off.
- Reply original text is visible only to its sender; other permitted readers see the optimized reply.
- Admin can hide visible messages and replies from the message detail page.

## Family Memory Checks

- Message creation refreshes relevant family/member/pair memories without blocking send on failure.
- Reply creation refreshes relevant memories without blocking reply on failure.
- Message/reply deletion marks relevant memories stale or causes recomputation.
- Admin hiding a message/reply marks relevant memories stale or causes recomputation.
- `useFamilyMemory: false` skips `FamilyMemory` query and injection.
- Memory never crosses family boundaries.
- Memory stores communication preferences, sensitive topics, avoid phrases, and effective phrases only.

## Permission Checks

- Unauthenticated users cannot access business APIs.
- Pending or rejected users cannot access family content.
- Non-family users cannot access messages, replies, notifications, member profiles, or memory by ID.
- Non-admin users cannot access admin APIs or admin pages.
- Muted users cannot create messages or replies.
- Admins cannot remove themselves, mute themselves, or demote/remove the last admin.
- Hidden original text/audio is not returned and does not enter AI context.

## AI Checks

- AI requests with existing content require `messageId`.
- Backend loads context only after permission checks.
- Ordinary conflict content returns optimized expression and advice.
- AI does not invent facts, force apology, force forgiveness, diagnose, or label personality.
- High-risk content returns high-risk handling, not ordinary warm rewriting.
- Provider failure returns a stable backend error and does not save partial AI output.

## Notification Checks

- New message creates notification for receiver.
- New reply creates notification for target user.
- Join request and join decision create notifications.
- Notification can be marked read.
- Notification opens related message when `messageId` exists.
- Join request notification opens the family join request review page for admins.

## Final Repository Checks

- `npx prisma validate --schema prisma/schema.prisma`
- `npx prisma generate --schema prisma/schema.prisma`
- `node -e "require('./src/app'); console.log('app loaded')"`
- App page list only contains family/message/admin pages.
- No old runtime class/diary/comment/like/report routes/pages/services.
- No tracked `server/.env`, uploads, logs, pid files, private WeChat config, OS metadata, or secrets.
