# PROJECT_STRUCTURE

```text
ai-recorder/
  AGENTS.md
  docker-compose.yml
  docs/
  server/
  miniprogram/
```

## server

- `prisma/schema.prisma`: independent `ai_recorder` database model.
- `prisma/migrations/20260606000000_init_ai_recorder/`: initial migration for the new project.
- `src/app.js`: Express app assembly.
- `src/server.js`: server entry.
- `src/routes/`: auth, family, message, reply, upload, notification, admin, AI routes.
- `src/controllers/`: thin HTTP controllers.
- `src/services/`: business services, including family memory and AI context construction.
- `src/middleware/`: auth and upload middleware.
- `src/utils/`: shared utilities.

## miniprogram

- `app.*`: global entry.
- `utils/`: config, request, auth, formatting, family identity helpers.
- `services/`: API clients for auth, family, message, reply, upload, notification, admin, AI.
- `pages/`: family selection, join family, message list/create/detail, notifications, profile, family admin.

## Removed Runtime Boundaries

The old template's class, diary, comment, like, and report routes/pages/services are not part of this project runtime. They must not be reintroduced without an explicit product decision.

## Configuration

- Default database: `ai_recorder`.
- AppID: `wxf73895336690e9a6`.
- Upload root: configured by `UPLOAD_DIR`, defaulting to `./uploads/ai-recorder`.
- Secrets stay in ignored local `.env` files.
