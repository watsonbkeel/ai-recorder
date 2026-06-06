# PERMISSION_MODEL

## Roles

- Family creator: creates a family and becomes that family's admin.
- Family admin: manages membership and basic family safety inside one family.
- Family member: sends and receives family messages inside joined families.

## Member Permissions

- Approved members may enter the family space.
- Pending or rejected users may not access family content.
- Muted members may read permitted content but may not create messages or replies.
- Senders control whether receivers may view original text or play original audio.
- Receivers may access messages sent to them, messages they sent, and family-visible messages.

## Admin Permissions

- Review join requests.
- View member list.
- Update member identity.
- Mute/unmute members.
- Set/remove admin role.
- Remove members.
- Hide messages and replies.

There is no report workflow.

## AI And Memory Permissions

- AI context must be built by backend services.
- Existing content context requires current family membership and message visibility checks.
- Family memory is scoped to the current family and must not cross families.
- `useFamilyMemory: false` disables memory lookup and injection.
- Hidden original text/audio must not enter AI context.
- Memory records may summarize communication preferences and sensitive topics, not personality or diagnosis.

## Restrictions

- Admins cannot remove themselves.
- Admins cannot mute themselves.
- The last admin cannot be demoted or removed.
- Admins do not bypass sender-controlled original text/audio permissions through ordinary APIs.
- Non-family members must not access messages, replies, notifications, upload metadata, member profiles, or memory by ID enumeration.
