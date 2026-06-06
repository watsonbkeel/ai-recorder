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

- `prisma/schema.prisma`: database model.
- `src/app.js`: Express app assembly.
- `src/server.js`: server entry.
- `src/routes/*`: route layer.
- `src/controllers/*`: controller layer.
- `src/services/*`: business layer.
- `src/middleware/*`: middleware.
- `src/utils/*`: shared utilities.

## miniprogram

- `app.*`: global entry.
- `utils/`: config, request, auth, formatting.
- `services/`: API clients.
- `pages/`: family space, message, reply, notification, profile, and admin pages.

## Migration Note

Current code may still contain class diary file names and route names. During implementation, migrate user-facing pages, APIs, database models, and documents to the family AI recorder vocabulary consistently.
