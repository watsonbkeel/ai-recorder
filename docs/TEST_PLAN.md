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
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

3. Check health:

```bash
curl http://127.0.0.1:3000/health
```

Experience environment may use:

```bash
curl http://bkeel.com:5300/health
```

## Mini Program Checks

1. Open `miniprogram/` in WeChat DevTools.
2. Login page appears by default.
3. New user can register with account name, password, and nickname.
4. Existing user can log in.
5. User enters family selection after login.
6. User can create a family and becomes admin.
7. Another user can request to join by invite code.
8. Admin can approve the request.
9. Approved member can enter the family timeline.

## Message Checks

- User can select receiver(s) and message type.
- User can enter original text.
- User can record and upload original voice.
- AI can generate optimized text, emotion tags, core need, advice, and risk level.
- Sender can choose whether original text is visible.
- Sender can choose whether original audio is playable.
- Receiver sees AI optimized text first.
- Receiver can only view/play original content when authorized.
- Receiver can use AI assisted reply.

## Permission Checks

- Unauthenticated users cannot access business APIs.
- Pending or rejected users cannot access family content.
- Non-family users cannot access messages, replies, notifications, or member profiles by ID.
- Non-admin users cannot access admin APIs or admin pages.
- Muted users cannot create messages or replies.
- Admins cannot remove themselves, mute themselves, or demote the last admin.

## Voice Checks

- WeChat recorder can start, stop, and cancel.
- Audio upload accepts configured WeChat recorder formats.
- Oversized audio returns a clear error.
- Successful upload path looks like `/uploads/audio/YYYY-Www/xxxx.m4a`.
- Authorized receiver can play audio on message detail.
- Unauthorized receiver does not receive audio URL.

## AI Checks

- Ordinary conflict content returns optimized expression, emotion tags, core need, advice, and risk level.
- AI does not invent facts.
- AI does not force apology or forgiveness.
- Aggressive wording is de-escalated while the real need remains.
- Self-harm, domestic violence, credible threat, and severe abuse content returns high-risk handling, not ordinary warm rewriting.
- Provider failure returns a stable backend error and does not save partial AI output.

## Notification Checks

- New message creates notification for receiver.
- New reply creates notification for target user.
- Join request handling creates notification.
- Report handling creates notification.
- Notification can be marked read.
- Notification opens related message and highlights reply when applicable.

## GitHub Checks

Before commit, confirm Git does not track:

- `server/.env`
- `server/node_modules/`
- user files under `server/uploads/`
- `server/server.log`
- `server/server.pid`
- `miniprogram/project.private.config.json`
- `.DS_Store`
- `._*`
