# AGENTS.md

## Project Mission

This project is a WeChat mini program for a family AI voice recorder, tentatively named "暖心留声机".

The product helps family members say difficult things more clearly and gently. AI acts as a translator for feelings, needs, and intent. It must not act as a judge, therapist, moral authority, or replacement for direct family responsibility.

## Product Principles

- AI is a translator, not a judge. Do not decide who is right or wrong.
- Improve expression without erasing emotion. Anger, sadness, disappointment, fear, and boundaries may be real and should not be softened into false agreement.
- Preserve user intent. Do not invent facts, apologies, promises, affection, or responsibilities that the user did not express.
- Promote family harmony through understanding, not through one-sided tolerance.
- Respect boundaries. Do not encourage users to accept abuse, coercion, humiliation, or emotional blackmail.
- Keep the original voice available when permitted. The AI version helps the message land; the original text or audio preserves the truth of the moment.
- Privacy is a core feature. Family content is private by default and must never be visible outside the family space.

## Technical Stack

- Frontend: native WeChat mini program, JavaScript, WXML, WXSS.
- Backend: Node.js, Express, Prisma, MySQL 8.0, JWT, Multer, axios.
- Infrastructure: Docker Compose for local MySQL.
- Do not migrate to Taro, UniApp, React, Vue, NestJS, MongoDB, SQLite, PostgreSQL, or a large new framework unless the user explicitly asks for that migration.

## Reuse Strategy

The existing class diary codebase is the starting point. Reuse the working structure and replace the domain model:

- `Class` becomes `Family`.
- `ClassMember` becomes `FamilyMember`.
- `Diary` becomes `Message`.
- `Comment` becomes `Reply`.
- Class invite, member approval, JWT auth, notifications, reports, upload handling, soft delete, and permission middleware should be reused where practical.

Do not keep class, teacher, student, diary, or classroom wording in user-facing surfaces after the family recorder migration.

## MVP Scope

The first usable version must include:

- Account registration and login.
- Create a family space.
- Invite or approve family members.
- Family member role or relationship labels such as father, mother, son, daughter, grandparent, partner, sibling, and other.
- Send a message to one or more family members.
- Text original message.
- Voice original message, upload, duration storage, and playback.
- AI optimized expression.
- AI emotion tags, core need, communication advice, and risk level.
- Receiver-side AI interpretation.
- AI assisted reply.
- Family timeline for sent, received, and family-visible messages.
- Basic privacy controls for original text and original audio.

Defer weekly reports, family temperature scores, anniversary reminders, counseling resource integrations, multiple-family advanced management, and analytics dashboards unless requested later.

## AI Safety Rules

AI output must:

- Preserve the user's real intent.
- Make expression clearer, more respectful, and less likely to escalate conflict.
- Identify emotions and needs without diagnosing people.
- Suggest responses that start with listening, acknowledgement, and boundaries.
- Return structured JSON for backend use.

AI output must not:

- Fabricate events or emotional motives.
- Force apologies.
- Tell someone to endure violence or humiliation for family harmony.
- Produce threats, insults, manipulation, or guilt-tripping.
- Frame obedience, control, or silence as healthy communication.
- Treat high-risk safety issues as ordinary wording problems.

High-risk content includes self-harm, suicide intent, domestic violence, credible threats, severe abuse, stalking, coercive control, and danger to minors. In high-risk cases, prioritize safety messaging and seeking real-world help; do not perform ordinary warm rewriting.

## Privacy And Permission Rules

- A user must be authenticated for all family content APIs.
- A user must be an approved family member to access family content.
- Original text and original audio visibility are controlled by the sender.
- Optimized text may be sent while original text or audio remains hidden.
- Removed members must lose access to future family content and any content they are no longer permitted to view.
- Soft deletion is preferred for user content so notification and moderation history remain consistent.
- Do not expose private content through notifications, logs, public upload URLs beyond intended file access, or admin/debug endpoints.

## Development Priorities

1. Keep the app runnable end to end.
2. Keep permission checks correct.
3. Keep family data isolated.
4. Keep AI output structured and safe.
5. Keep user-facing copy warm, plain, and non-judgmental.
6. Keep implementation close to the existing project patterns.

## GitHub Rules

- Repository remote: `https://github.com/watsonbkeel/ai-recorder`.
- Do not commit secrets, `.env`, logs, pid files, runtime uploads, node_modules, WeChat private project config, `.DS_Store`, or `._*` metadata.
- Commit docs and source together when they describe the same behavior.
- Use `main` as the default branch.
