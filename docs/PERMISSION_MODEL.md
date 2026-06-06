# PERMISSION_MODEL

## Roles

- Family creator: any logged-in user may create a family and becomes that family's admin.
- Family admin: manages membership and moderation inside one family.
- Family member: uses message and reply features inside joined families.

## Member Permissions

- Approved members may enter the family space.
- Pending or rejected users may not access family content.
- Muted members may not create messages or replies.
- Senders control whether receivers may view original text or play original audio.
- Receivers may access messages sent to them, messages they sent, and family-visible messages.

## Admin Permissions

- Review join requests.
- View member list.
- Mute or unmute members.
- Set or remove admin role.
- Remove members.
- Hide messages and replies.
- Handle reports.

## Restrictions

- Admins cannot remove themselves.
- Admins cannot mute themselves.
- The last admin cannot be demoted.
- Admins must not bypass sender-controlled original text or original audio permissions except through an explicit report or safety review flow.
- Normal APIs must not return original text, original audio URL, or internal AI safety fields to users without permission.
- Non-family members must not access messages, replies, notifications, upload metadata, or member profiles by ID enumeration.
