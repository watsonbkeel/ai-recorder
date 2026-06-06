# API_SPEC

## Base Contract

- API prefix: `/api`
- Auth header: `Authorization: Bearer <token>`
- Success response: `{ success, data, message }`
- Error response: `{ success: false, error: { code, message } }`
- Main login method for the current codebase remains account name + password.
- If WeChat login is restored later, family isolation and JWT authorization rules must remain unchanged.

## Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

`PATCH /api/auth/me` may update global nickname and avatar.

## Family

- `POST /api/families`: any logged-in user may create a family; creator becomes family admin.
- `GET /api/families/my`: list families joined by the current user.
- `GET /api/families/by-invite/:inviteCode`: find a family by invite code.
- `PATCH /api/families/:familyId/nickname`: update current user's family nickname.
- `PATCH /api/families/:familyId/relationship`: update current user's relationship label.
- `POST /api/families/:familyId/join-requests`: request to join a family; admin approval required.

Family item example:

```json
{
  "id": 1,
  "name": "我们家",
  "description": "家庭描述",
  "inviteCode": "ABC123",
  "memberCount": 4,
  "messageCount": 34,
  "role": "member",
  "familyNickname": "小明",
  "relationship": "son",
  "isMuted": false,
  "joinedAt": "2026-05-06T00:00:00.000Z",
  "joinStatus": "joined",
  "joinRequestId": 10
}
```

`joinStatus`: `none`, `pending`, `approved`, `rejected`, `joined`.

## Message

- `GET /api/families/:familyId/messages`
- `POST /api/families/:familyId/messages`
- `GET /api/messages/:messageId`
- `DELETE /api/messages/:messageId`

Messages support original text, original audio, AI optimized text, receiver list, visibility, original-content permissions, soft delete, and risk level.

Create message example:

```json
{
  "receiverIds": [2],
  "visibility": "private",
  "messageType": "grievance",
  "originalText": "你总是不听我说完",
  "originalAudioUrl": "/uploads/audio/2026-W23/xxx.m4a",
  "audioDurationSec": 18,
  "optimizedText": "爸，我有时候会觉得自己还没说完就被打断...",
  "emotionTags": ["委屈", "不被理解"],
  "coreNeed": "希望被完整倾听",
  "aiAdvice": "建议先表达感受，再提出具体请求。",
  "riskLevel": "low",
  "allowOriginalTextView": false,
  "allowOriginalAudioPlay": true
}
```

## Reply

- `GET /api/messages/:messageId/replies`
- `POST /api/messages/:messageId/replies`
- `DELETE /api/replies/:replyId`

Replies store original reply text, AI optimized reply text, emotion tags, advice, risk level, and soft-delete status.

## AI

- `POST /api/ai/optimize-message`
- `POST /api/ai/analyze-message`
- `POST /api/ai/optimize-reply`

All AI routes require login. If a request references existing family content, the backend must verify current user membership and content visibility.

## Upload

- `POST /api/upload/image`
- `POST /api/upload/audio`

Rules:

- Upload requires login.
- Request uses `multipart/form-data`.
- File field name: `file`.
- Images allow `jpg/jpeg/png/webp`, max 5MB.
- Audio supports WeChat recorder formats configured by the backend.
- Files are stored by type and ISO week: `/uploads/<type>/YYYY-Www/`.

Response example:

```json
{
  "url": "/uploads/audio/2026-W23/xxxx.m4a",
  "fullUrl": "http://bkeel.com:5300/uploads/audio/2026-W23/xxxx.m4a"
}
```

## Report

- `POST /api/reports`

Reports support `message` and `reply` targets.

## Notification

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/read-all`
- `POST /api/notifications/:notificationId/read`

Notifications may link to `messageId` and `replyId`. The mini program should mark the notification read before opening the related message.

## Admin

- `GET /api/admin/families/:familyId/dashboard`
- `GET /api/admin/families/:familyId/join-requests`
- `POST /api/admin/join-requests/:requestId/handle`
- `GET /api/admin/families/:familyId/members`
- `POST /api/admin/families/:familyId/members/:userId/mute`
- `POST /api/admin/families/:familyId/members/:userId/role`
- `DELETE /api/admin/families/:familyId/members/:userId`
- `GET /api/admin/families/:familyId/reports`
- `POST /api/admin/reports/:reportId/handle`
- `POST /api/admin/messages/:messageId/hide`
- `POST /api/admin/replies/:replyId/hide`

Admin routes require current user to be an admin in the target family. Admin access must not bypass sender-controlled original text or original audio permissions except through an explicit report or safety review flow.
