# DATABASE_SCHEMA

This project uses `Prisma + MySQL 8.0`.

## Enums

- `FamilyRole`: `member` / `admin`
- `FamilyRelationship`: `father` / `mother` / `son` / `daughter` / `grandparent` / `partner` / `sibling` / `other`
- `JoinRequestStatus`: `pending` / `approved` / `rejected`
- `ContentStatus`: `visible` / `hidden` / `deleted`
- `MessageVisibility`: `private` / `family` / `self`
- `MessageType`: `thanks` / `apology` / `grievance` / `request` / `explain` / `stress` / `repair` / `encouragement` / `general`
- `RiskLevel`: `low` / `medium` / `high`
- `ReportTargetType`: `message` / `reply`
- `ReportStatus`: `pending` / `resolved` / `rejected`
- `NotificationType`: `message_received` / `message_replied` / `report_handled` / `join_request_approved` / `join_request_rejected`
- `ModerationTargetType`: `join_request` / `message` / `reply` / `member` / `report`
- `ModerationAction`: `approve_join_request` / `reject_join_request` / `hide_message` / `hide_reply` / `mute_member` / `unmute_member` / `remove_member` / `set_admin` / `unset_admin` / `resolve_report` / `reject_report`

## Models

- `User`
- `Family`
- `FamilyMember`
- `JoinRequest`
- `Message`
- `MessageReceiver`
- `Reply`
- `Report`
- `Notification`
- `ModerationLog`

## Design Constraints

- All family content is strongly isolated by `familyId`.
- Only approved family members may access family content.
- `Message` stores original text, original audio URL, audio duration, AI optimized text, emotion tags, core need, AI advice, and risk level.
- `Message` uses `allowOriginalTextView` and `allowOriginalAudioPlay` to control receiver access to original content.
- `MessageReceiver` supports sending one message to one or more family members and records per-receiver read/reply state.
- `Reply` stores original reply text and AI optimized reply text.
- `Message` and `Reply` use `status` for soft delete and moderation hiding.
- `Report` and `ModerationLog` use `targetType + targetId` for polymorphic targets.
- High-risk AI results must be persisted for safety review and future product behavior.
