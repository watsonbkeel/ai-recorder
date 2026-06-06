# IMPLEMENTATION_PLAN

## Current State

The current codebase comes from a "class diary" mini program. It already has a native WeChat mini program, Node.js Express backend, Prisma + MySQL database, Docker Compose MySQL, upload handling, JWT auth, notifications, reports, soft delete, and admin management.

The new target is "暖心留声机", a family AI voice recorder. Keep the working architecture and migrate the domain model and user experience.

## Phase 1: Documents And GitHub

1. Add `AGENTS.md`, `docs/PRODUCT_REQUIREMENTS.md`, and `docs/AI_CONSTRAINTS.md`.
2. Update existing docs from class diary semantics to family recorder semantics.
3. Initialize Git and connect remote `https://github.com/watsonbkeel/ai-recorder`.
4. Ensure secrets, logs, uploads, private WeChat config, and OS metadata are ignored.

## Phase 2: Backend Migration

1. Rename domain concepts from `Class`, `ClassMember`, `Diary`, and `Comment` to `Family`, `FamilyMember`, `Message`, and `Reply`.
2. Add message receiver list, visibility, message type, original voice URL, audio duration, AI fields, original-content permissions, and risk level.
3. Add audio upload support.
4. Add OpenAI-compatible AI service and routes for message optimization, message analysis, and reply optimization.
5. Preserve auth, join approval, notifications, reports, moderation, and soft delete.

## Phase 3: Mini Program Migration

1. Replace class, diary, and comment pages with family, message, and reply pages.
2. Add receiver selection, message type selection, text input, recorder controls, AI optimization, and original-content permission controls.
3. Make message detail show AI optimized text first, original content folded, and voice playback only when permitted.
4. Add AI assisted reply flow.

## Phase 4: Regression And Safety

1. Verify family member isolation.
2. Verify original text and original audio permissions.
3. Verify high-risk AI handling.
4. Verify notifications, reports, soft delete, and admin operations.

## Priorities

- End-to-end runnable behavior first.
- Correct permissions and family data isolation first.
- AI safety and privacy first.
- Voice recording, upload, and playback are MVP requirements.
- Do not add weekly reports, temperature scores, anniversaries, public sharing, or analytics dashboards unless requested later.
