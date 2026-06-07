# PRODUCT_REQUIREMENTS

## Product

Name: 暖心留声机

Positioning: 家庭 AI 留声机小程序，帮助家庭成员用文字和语音表达不容易说出口的心声。AI 将不清晰、情绪化或容易激化矛盾的表达整理成更清楚、更温和、更容易被家人理解的暖心表达，同时保留用户真实意图和边界。

One-line description:

> 让家人听见你的心里话。

## Core Value

- 帮助父母、子女、伴侣、手足和长辈表达难以直接说出口的话。
- 减少因为表达方式、代际差异、情绪升级和理解偏差造成的误会。
- 帮助接收方理解表达背后的情绪、需要和边界。
- 鼓励倾听、修复、尊重和真实沟通。

## MVP Features

- WeChat login/register, with account/password login retained for local debugging and fallback.
- Family space creation and invite-code join flow.
- Admin approval for join requests.
- Family identity uses tappable family positions: father, mother, and default child slots. Father/mother imply role and gender; child slots ask son/daughter and keep order through the chosen slot.
- Send text and/or voice messages to selected family positions, selected registered members, the whole family, or self only.
- Private messages may target an unregistered family position so the sender can leave a message before that family member joins.
- Self-only messages are for整理自己的想法: they do not notify family members and do not accept replies.
- Store original text/audio and AI optimized text separately.
- Current MVP records and uploads voice, automatically attempts transcription, and still keeps the original audio for optional receiver playback.
- Sender-controlled permission for original text and original audio.
- AI optimized expression for messages and replies. Message sending defaults to AI optimization before create; if AI fails, the user sees a clear fallback.
- AI message analysis based on backend-verified visible context.
- Staged AI waiting feedback for message optimization, message analysis, and reply optimization.
- Family communication memory with `family`, `member`, and `pair` scopes.
- User switch to disable AI family memory use.
- Family timeline with sent, received, and family-visible messages.
- Notifications for new messages, replies, join requests, and join decisions.
- Admin dashboard, member management, muting, role management, and hide message/reply.

## Explicit Non-Goals

- No report/举报 feature.
- No public feed, popularity, ranking, likes, or social metrics.
- No cross-family AI memory.
- No reuse of old project users, uploads, migration history, or runtime data.

## Message Types

- Gratitude.
- Apology.
- Grievance.
- Request.
- Explanation.
- Pressure or stress.
- Relationship repair.
- Encouragement.
- General message.

## Privacy Defaults

- Family content is not public.
- A message is private to sender and receiver(s) by default.
- `private` messages are visible only to the sender and selected receivers.
- `family` messages are visible to approved members of the same family.
- `self` messages are visible only to the sender and do not notify family members.
- `self` messages do not show reply controls and backend reply endpoints reject them.
- Original text and original audio are hidden unless the sender enables access.
- AI context must not include hidden original text/audio.
- Family memory is used only inside the current family and only when enabled by the user.

## Deferred Features

- Family periodic summary.
- Emotion trend visualization.
- Anniversary and care reminders.
- Professional counseling resource integration.
- Multiple family advanced management.
- Public sharing.
