# UX_FLOW

## Pages

- `pages/login/login`
- `pages/family-select/family-select`
- `pages/join-family/join-family`
- `pages/message-list/message-list`
- `pages/message-create/message-create`
- `pages/message-detail/message-detail`
- `pages/notifications/notifications`
- `pages/profile/profile`
- `pages/admin/dashboard/dashboard`
- `pages/admin/join-requests/join-requests`
- `pages/admin/members/members`

## Login

1. User signs in with WeChat login. First WeChat login creates the user account automatically.
2. Account name/password login remains available for local debugging and fallback.
3. After login, user enters family selection.

## Family Setup

1. User creates a family or joins by invite code.
2. User sets family identity: relationship, gender, child order, birth year, family nickname, preferred title, and identity note.
3. Creator becomes family admin.
4. Join requests require admin approval.

## Message Flow

1. Enter family timeline.
2. Tap write message.
3. Select message scope:
   - 指定家人: choose one or more receivers from family members.
   - 全家可见: all approved family members can see the message; backend computes receivers and notifications.
   - 仅自己: save for self, do not notify family members, and do not show original-content permission switches.
4. Enter original text, a short text summary of the voice message, record voice, or combine them.
5. Choose whether AI may use family communication memory. Default: on.
6. Tap AI optimize. Current MVP does not auto-transcribe voice; AI optimization requires text original content or a manually written voice summary.
7. While AI is working, the page shows staged status copy such as understanding the original expression, identifying emotions and needs, and preserving intent and boundaries. The user may continue editing the original input while waiting.
8. Review optimized expression, emotion tags, core need, advice, risk warning.
9. If the message only has voice and no text summary, manually fill the expression family members should read first.
10. For messages shared with family members, choose whether receivers may view original text or play original audio.
11. Send or save message.

## Detail And Reply

1. Receiver sees optimized text first.
2. Original text/audio appears only if the sender allowed it.
3. Receiver may turn family memory on/off and ask AI to help understand the message.
4. While AI is analyzing, the detail page shows staged status copy for understanding emotions, needs, avoid phrases, and suggested response.
5. Receiver writes original reply.
6. Receiver may turn family memory on/off before AI optimizes the reply.
7. While AI is optimizing the reply, the page shows staged status copy and the reply textarea remains editable.
8. Reply is saved with original text and optimized text. The original reply is visible only to its sender.

## Profile

- Edit global nickname/avatar.
- Switch current family.
- Returning to the family timeline after switching family reloads the timeline for the newly selected family.
- Edit current family identity.
- Enter family admin page when the current user is admin.

## Admin

- Dashboard shows pending join requests, member count, message count, reply count, and muted member count.
- Admin reviews join requests with applicant identity.
- Admin manages members, family identity, roles, mute state, and removal.
- Admin may hide messages/replies from the message detail page.
- No report page or report handling exists.

## Notifications

- Message and reply notifications open the related message detail.
- Join request notifications open the family join request review page when the receiver is an admin.
- Join approval notifications refresh the user's family list, switch to the approved family, and open that family timeline.
- Join rejection notifications show the application result message.

## Copy Rules

- User-facing copy uses family / 留声 / 留言 / 暖心表达 language.
- Avoid public-social mechanics such as ranking and popularity.
- Original expression is handled as private, sensitive family content.
