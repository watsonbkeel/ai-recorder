# API_SPEC

## Base Contract

- API prefix: `/api`
- Auth header: `Authorization: Bearer <token>`
- Success response: `{ success, data, message }`
- Error response: `{ success: false, error: { code, message } }`
- All family content APIs require login.

## Auth

- `POST /api/auth/wechat-login`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

Wechat login request:

```json
{
  "code": "wx.login code",
  "nickname": "家人",
  "avatarUrl": "https://example.com/avatar.png"
}
```

Rules:

- Backend exchanges `code` through WeChat `jscode2session`.
- `WECHAT_APPID` and `WECHAT_SECRET` must come from ignored local `server/.env`.
- Account/password auth remains available for local debugging and fallback.

## Family

- `POST /api/families`
- `GET /api/families/my`
- `GET /api/families/by-invite/:inviteCode`
- `GET /api/families/:familyId/members`
- `PATCH /api/families/:familyId/identity`
- `PATCH /api/families/:familyId/nickname`
- `PATCH /api/families/:familyId/relationship`
- `POST /api/families/:familyId/join-requests`

Family identity fields:

```json
{
  "relationship": "father|mother|son|daughter|child|grandfather|grandmother|grandparent|partner|sibling|other",
  "gender": "male|female|unspecified",
  "childOrder": 1,
  "birthYear": 2008,
  "familyNickname": "小明",
  "preferredTitle": "哥哥",
  "identityNote": "异地上学"
}
```

## Message

- `GET /api/families/:familyId/messages`
- `POST /api/families/:familyId/messages`
- `GET /api/messages/:messageId`
- `GET /api/messages/:messageId/original-audio`
- `DELETE /api/messages/:messageId`

Create message example:

```json
{
  "receiverIds": [2],
  "visibility": "private",
  "messageType": "grievance",
  "originalText": "你总是不听我说完",
  "originalAudioUrl": "/uploads/audio/2026-W23/xxx.m4a",
  "audioDurationSec": 18,
  "optimizedText": "爸，我希望你能先听我把话说完...",
  "emotionTags": ["委屈", "不被理解"],
  "coreNeed": "希望被完整倾听",
  "aiAdvice": "先表达感受，再提出具体请求。",
  "riskLevel": "low",
  "allowOriginalTextView": false,
  "allowOriginalAudioPlay": true
}
```

`originalAudioUrl` in the create payload is the storage reference returned by `POST /api/upload/audio`. Message read APIs return a protected playback URL only when the current viewer is allowed to play the original audio.

Message visibility:

- `private`: `receiverIds` must contain at least one approved member of the same family, excluding the sender.
- `family`: backend ignores client-provided receiver coverage and creates receiver records/notifications for current approved family members other than the sender. The message is visible to approved members of this family.
- `self`: backend stores no receivers and creates no message notifications. The message is visible only to the sender.

## Reply

- `GET /api/messages/:messageId/replies`
- `POST /api/messages/:messageId/replies`
- `DELETE /api/replies/:replyId`

## AI

- `POST /api/ai/optimize-message`
- `POST /api/ai/analyze-message`
- `POST /api/ai/optimize-reply`

AI requests support:

```json
{
  "familyId": 1,
  "visibility": "private",
  "receiverIds": [2],
  "messageId": 10,
  "originalText": "string",
  "useFamilyMemory": true
}
```

Rules:

- Backend builds the AI context.
- For `optimize-message`, backend resolves receiver identity context from `familyId`, `visibility`, and permitted family members.
- `optimize-message` requires `originalText`; current MVP does not auto-transcribe `hasOriginalAudio`.
- Existing content context must be loaded by `messageId` after permission checks.
- Frontend must not inject arbitrary history, summaries, or memory.
- `useFamilyMemory: false` fully disables `FamilyMemory` query and injection.
- Hidden original text/audio must not enter AI context.
- Original audio playback must use `GET /api/messages/:messageId/original-audio` with authentication. The endpoint checks message visibility and sender audio permission before streaming the uploaded audio file.

## Upload

- `POST /api/upload/image`
- `POST /api/upload/audio`

Rules:

- Upload requires login.
- Request uses `multipart/form-data`.
- File field name: `file`.
- Audio upload accepts common WeChat recorder formats and tolerates empty or `application/octet-stream` MIME when the extension is a known audio type.
- Image upload may return a public `fullUrl`; audio upload returns only the storage `url` used when creating a message.
- Files are stored by type and ISO week under the configured upload directory. Images may be served from `/uploads/image/...`; original audio is not exposed as a public static file and must be played through the authenticated message endpoint.

## Notification

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/read-all`
- `POST /api/notifications/:notificationId/read`

Notifications may link to `familyId`, `messageId`, and `replyId`.
Join request notifications use `familyId` to open the admin review page in the mini program.
Family-scoped message, reply, and join-review notifications are returned only when the current user still belongs to that family. Join approval/rejection notifications are personal outcome notices and may remain visible even if the applicant is not yet a family member.

## Admin

- `GET /api/admin/families/:familyId/dashboard`
- `GET /api/admin/families/:familyId/join-requests`
- `POST /api/admin/join-requests/:requestId/handle`
- `GET /api/admin/families/:familyId/members`
- `POST /api/admin/families/:familyId/members/:userId/mute`
- `POST /api/admin/families/:familyId/members/:userId/role`
- `PATCH /api/admin/families/:familyId/members/:userId/identity`
- `DELETE /api/admin/families/:familyId/members/:userId`
- `POST /api/admin/messages/:messageId/hide`
- `POST /api/admin/replies/:replyId/hide`

There is no report API in this project.
