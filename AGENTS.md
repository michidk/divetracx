# Divetracx agent guide

Divetracx is a self-hosted dive log built with Bun, TanStack Start, React 19,
PostgreSQL, and Drizzle. Its first migration path imports DiveMate `.ddb`
SQLite backups without making the application depend on DiveMate at runtime.

## Documentation

`README.md` is the only user-facing document besides `charts/README.md` and
`.env.example`; keep configuration, deployment, and demo notes there instead
of adding files under `docs/`. `DESIGN.md` is the visual and interaction
contract — consult it before adding or changing UI, and update it when a
pattern changes.

## Architecture

- Pages use folder routes (`src/routes/<segment>/index.tsx`).
- Route-private UI lives in a hyphen-prefixed colocated folder.
- Reuse generic components from `src/components/` instead of duplicating UI
  markup or styles. When a UI pattern gains a second consumer, create or
  promote a shared generic component with one consistent visual contract.
- Reusable dive and DiveMate code lives in `src/modules/`; modules never import
  from `src/routes/`.
- PostgreSQL/Drizzle definitions live in `src/db/`.
- Database access, backup downloads, SQLite parsing, and synchronization stay
  server-only.
- DiveMate synchronization is additive and idempotent. Imported external IDs
  are upserted; records missing from a later backup are not deleted.
- Never add legacy fields to the canonical schema or UI. Preserve older source
  formats with database migrations and import mappings that translate their data
  into canonical entities and relationships.
- Do not expose `DATABASE_URL`, `HODOR_SECRET`, or Google service-account
  credentials to browser code.
- The MCP endpoint (`src/modules/mcp/`) is read-only and protected by the
  built-in OAuth 2.1 server, which derives its signing key from `HODOR_SECRET`
  and gates consent through the Hodor owner session. `/api/mcp`, `/oauth/*`,
  and the `/.well-known/oauth-*` routes bypass Hodor; nothing else may.

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
`bun run verify` includes Knip; remove dead exports instead of adding ignores.

Never commit personal dive data, DiveMate backups, recovered media, image-gen
outputs, or working notes derived from a real database. Keep such files under
the ignored `backups/`, `uploads/`, `output/`, or `.artifacts/` directories.

Helm changes must pass `bun run check:helm`. Image/runtime changes must also be
verified with a Docker build. The daily CronJob and the manual button must call
the same synchronization service and record distinct trigger values.
