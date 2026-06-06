# DATABASE_SCHEMA

Database: `ai_recorder`

This project uses Prisma + MySQL 8.0 and has its own initial migration. It must not reuse old class-log migrations or runtime data.

## Enums

- `FamilyRole`: `member` / `admin`
- `FamilyRelationship`: `father` / `mother` / `son` / `daughter` / `child` / `grandfather` / `grandmother` / `grandparent` / `partner` / `sibling` / `other`
- `FamilyGender`: `male` / `female` / `unspecified`
- `JoinRequestStatus`: `pending` / `approved` / `rejected`
- `ContentStatus`: `visible` / `hidden` / `deleted`
- `MessageVisibility`: `private` / `family` / `self`
- `FamilyMessageType`: `thanks` / `apology` / `grievance` / `request` / `explain` / `stress` / `repair` / `encouragement` / `general`
- `RiskLevel`: `low` / `medium` / `high`
- `MessageReceiverStatus`: `unread` / `read` / `replied`
- `NotificationType`: join request, message received, message replied
- `FamilyAdminTargetType`: `join_request` / `message` / `reply` / `member`
- `FamilyMemoryScope`: `family` / `member` / `pair`
- `FamilyMemoryStatus`: `active` / `stale`

## Models

- `User`
- `Family`
- `FamilyMember`
- `FamilyJoinRequest`
- `FamilyMessage`
- `FamilyMessageReceiver`
- `FamilyReply`
- `FamilyMemory`
- `Notification`
- `FamilyAdminLog`

There is no report model.

## Message Visibility

- `private`: sender plus selected receivers.
- `family`: approved members in the same family.
- `self`: sender only.

## Family Identity

`FamilyMember` and `FamilyJoinRequest` store:

- `relationship`
- `gender`
- `childOrder`
- `birthYear`
- `familyNickname`
- `preferredTitle`
- `identityNote`

This supports parents, multiple children, rank among children, gender, and family-specific称呼.

## Family Memory

`FamilyMemory` stores:

- `familyId`
- `scope`
- `scopeKey`
- `memberId`
- `relatedMemberId`
- `summary`
- `avoidPhrases`
- `effectivePhrases`
- `sensitiveTopics`
- `status`
- `version`
- `sourceMessageCount`
- `sourceReplyCount`
- `sourceMessageId`
- `sourceReplyId`
- timestamps

Active memory may be used only inside the same family and only when the user enables family memory for AI.

## Privacy Constraints

- All family content is isolated by `familyId`.
- Only approved family members may access family content.
- Message original text/audio visibility is controlled by the sender.
- Normal APIs must not return hidden original text or hidden original audio URLs.
- Deleting or hiding messages/replies must invalidate or recompute affected family memory.
