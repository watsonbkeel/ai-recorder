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
- Original audio playback uses the authenticated `GET /api/messages/:messageId/original-audio` endpoint; uploaded audio files are not publicly exposed through static file serving.
- Reply original text is visible only to the reply sender; other permitted readers see the optimized reply.
- Receivers may access messages sent to them, messages they sent, and family-visible messages.
- Self-only messages are accessible only to the sender, do not create receiver notifications, do not accept replies, and do not support AI reply optimization.
- Family-scoped notifications for messages, replies, and join-review work are visible only while the receiver is still a member of that family.
- Notifications linked to hidden or deleted messages/replies are excluded from lists and unread counts.
- Join approval/rejection notifications are personal outcome notices and remain visible to the applicant.

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
- Private AI message optimization must resolve at least one valid receiver from the current family on the backend.
- Family memory is scoped to the current family and must not cross families.
- `useFamilyMemory: false` disables memory lookup and injection.
- Hidden original text/audio must not enter AI context.
- Memory records may summarize communication preferences and sensitive topics, not personality or diagnosis. Family-visible message/reply memory uses current approved family membership; private message memory stays limited to direct participants.

## Restrictions

- Admins cannot remove themselves.
- Admins cannot mute themselves.
- The last admin cannot be demoted or removed.
- Admins do not bypass sender-controlled original text/audio permissions through ordinary APIs.
- Admins do not receive reply original text through ordinary reply APIs unless they wrote that reply.
- Non-family members must not access messages, replies, notifications, upload metadata, member profiles, or memory by ID enumeration.
- Removed members must not continue seeing old family message/reply notification summaries or unread counts.
