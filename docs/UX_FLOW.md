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
- `pages/admin/reports/reports`

Current code may still use old class diary file names during migration. Final user-facing wording must use family recorder terms.

## Login Flow

1. Open mini program.
2. Check local token.
3. Without token, enter login page.
4. New user registers with account name, password, and nickname.
5. Existing user logs in with account name and password.
6. After login, enter family selection.

## Family Selection Flow

1. Show user's joined families.
2. Each family card shows role, family nickname, relationship, and member count.
3. Tapping a family enters the family message timeline.
4. User can create a family from the family selection page.
5. Creator becomes family admin.
6. Other members join through invite code and admin approval.

## Message Flow

1. Enter family timeline.
2. Tap "写给家人".
3. Select receiver(s) and message type.
4. Enter original text, record original voice, or provide both.
5. Tap "AI 帮我整理表达".
6. Review AI optimized text, emotion tags, core need, communication advice, and risk warning.
7. Choose whether the receiver may view original text or play original audio.
8. Send message.
9. Receiver reads AI optimized text first.
10. Receiver may view AI interpretation.
11. Receiver may expand original text or play original voice only if permitted.
12. Receiver uses AI assisted reply.

## Detail Page

- Show AI optimized message as the primary content.
- Show sender, receiver, message type, emotion tags, and core need.
- Fold original content behind a warning.
- Display original text and voice controls only when permission allows.
- Show replies in chronological order.
- Provide "AI 帮我回复" action.

## Notification Flow

1. New message, new reply, join request handling, and report handling produce notifications.
2. Notification list shows unread state.
3. Tapping a notification marks it read and opens the related message.
4. If linked to a reply, message detail highlights that reply.

## Profile Page

- View current user info.
- Edit global nickname.
- Edit family nickname and relationship.
- Manage notification preferences.
- Log out and clear local token.

## Admin Flow

Only `currentFamily.role === 'admin'` displays admin entry.

Admins can:

- Review join requests.
- View and manage members.
- Mute or unmute members.
- Set or remove admin role.
- Remove members.
- Review reports.
- Hide inappropriate messages or replies.

## UX Requirements

- Every page needs loading, empty, and error states.
- Use warm, plain, non-judgmental Chinese copy.
- Do not use public-social patterns such as ranking, popularity, or competitive metrics.
- Original expression is folded by default and preceded by a gentle warning.
