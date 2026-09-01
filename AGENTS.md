# Divetracx agent guide

Divetracx is a self-hosted dive log built with Bun, TanStack Start, React 19,
PostgreSQL, and Drizzle. Its first migration path imports DiveMate `.ddb`
SQLite backups without making the application depend on DiveMate at runtime.

## Architecture

- Pages use folder routes (`src/routes/<segment>/index.tsx`).
- Route-private UI lives in a hyphen-prefixed colocated folder.
- Reusable dive and DiveMate code lives in `src/modules/`; modules never import
  from `src/routes/`.
- PostgreSQL/Drizzle definitions live in `src/db/`.
- Database access, backup downloads, SQLite parsing, and synchronization stay
  server-only.
- DiveMate synchronization is additive and idempotent. Imported external IDs
  are upserted; records missing from a later backup are not deleted.
- Do not expose `DATABASE_URL` or Google service-account credentials to browser code.

## Commands

```bash
bun install --frozen-lockfile
docker compose up -d postgres
bun run db:migrate
bun run dev
bun run sync:divemate
bun run verify
```

Change `src/db/schema.ts` first, then run `bun run db:generate` and commit the
generated migration and metadata together. Never edit `src/routeTree.gen.ts`.

Helm changes must pass `bun run check:helm`. Image/runtime changes must also be
verified with a Docker build. The daily CronJob and the manual button must call
the same synchronization service and record distinct trigger values.
