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

1. User registers or logs in with account name and password.
2. After login, user enters family selection.

## Family Setup

1. User creates a family or joins by invite code.
2. User sets family identity: relationship, gender, child order, birth year, family nickname, preferred title, and identity note.
3. Creator becomes family admin.
4. Join requests require admin approval.

## Message Flow

1. Enter family timeline.
2. Tap write message.
3. Select receiver(s) from family members.
4. Enter original text, record voice, or both.
5. Choose whether AI may use family communication memory. Default: on.
6. Tap AI optimize.
7. Review optimized expression, emotion tags, core need, advice, risk warning.
8. Choose whether receiver may view original text or play original audio.
9. Send message.

## Detail And Reply

1. Receiver sees optimized text first.
2. Original text/audio appears only if the sender allowed it.
3. Receiver may turn family memory on/off and ask AI to help understand the message.
4. Receiver writes original reply.
5. Receiver may turn family memory on/off before AI optimizes the reply.
6. Reply is saved with original text and optimized text. The original reply is visible only to its sender.

## Profile

- Edit global nickname/avatar.
- Switch current family.
- Edit current family identity.
- Enter family admin page when the current user is admin.

## Admin

- Dashboard shows pending join requests, member count, message count, reply count, and muted member count.
- Admin reviews join requests with applicant identity.
- Admin manages members, family identity, roles, mute state, and removal.
- Admin may hide messages/replies.
- No report page or report handling exists.

## Copy Rules

- User-facing copy uses family / 留声 / 留言 / 暖心表达 language.
- Avoid public-social mechanics such as ranking and popularity.
- Original expression is handled as private, sensitive family content.
