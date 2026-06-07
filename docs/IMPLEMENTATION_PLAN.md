# IMPLEMENTATION_PLAN

## Boundary

The old project is only a code template. The new project must have independent configuration, database, AppID, API, frontend entry, admin flow, uploads, migrations, user identity, and AI memory.

## Completed Target

- Independent MySQL database: `ai_recorder`.
- Independent initial Prisma migration.
- AppID: private local configuration only; tracked mini program config keeps the `touristappid` placeholder.
- Family domain models and routes.
- Family identity fields on member and join request.
- Message/reply workflow.
- AI optimization/analyze/reply endpoints.
- Family communication memory with `family`, `member`, and `pair` scopes.
- `useFamilyMemory` switch on AI calls.
- No report feature.

## Implementation Priorities

1. Keep backend permission checks correct.
2. Keep memory inside the current family only.
3. Keep hidden original text/audio out of AI context.
4. Keep identity useful for称呼 and表达适配, not stereotypes.
5. Keep secrets out of git.

## Validation

- `npx prisma validate --schema prisma/schema.prisma`
- `npx prisma generate --schema prisma/schema.prisma`
- `node -e "require('./src/app'); console.log('app loaded')"`
- Check old class/report/diary runtime entries are absent.
- Check no PAT, AI API key, provider secret, full WeChat AppID, or WeChat Secret is tracked.
