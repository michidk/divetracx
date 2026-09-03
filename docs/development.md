# Development and testing

## Prerequisites

- Bun 1.4.0
- PostgreSQL 18 for application development and import integration tests
- Docker when running the complete stack or the Helm check without a local
  `helm` binary

Install dependencies from the committed lockfile:

```bash
bun install --frozen-lockfile
```

## Development server

Copy the example environment and point `DATABASE_URL` at a development
database. The default URL expects the Compose PostgreSQL on `localhost:5433`.

```bash
cp .env.example .env
docker compose up -d postgres
bun run db:migrate
bun run dev
```

The development server listens on <http://localhost:3000> and intentionally
does not include the production Hodor authentication gate. It applies pending
committed migrations before accepting requests and watches for newly generated
Drizzle migrations while running, applying them serially and triggering a full
page reload.

## Database workflow

`bun run db:migrate` is the canonical initialization and upgrade command. It
applies the migrations committed under `drizzle/` and is invoked by the local
development server, Docker Compose, CI, and the Helm migration Job.

For a schema change:

1. Update `src/db/schema.ts`.
2. Run `bun run db:generate`.
3. Review the SQL and generated Drizzle metadata.
4. Run `bun run db:migrate` against a disposable development database.
5. Run the import integration tests.

`bun run db:push` bypasses migration generation and is reserved for throwaway
local databases. `bun run db:migrate:cli` exposes the lower-level Drizzle Kit
command, and `bun run db:studio` opens Drizzle Studio.

`bun run db:seed` loads the same fictional records as the database-free public
demo. Run it against an empty database after applying migrations.

## Tests and quality checks

```bash
bun run check          # Biome formatting and lint
bun run typecheck      # TypeScript without emit
bun run test           # bun test; integration suites report as skipped
bun run lint:deadcode  # Knip
bun run check:helm     # helm lint and template (falls back to Docker)
bun run verify         # all of the above plus a production build
```

Two integration suites are gated behind environment variables because they
need real infrastructure:

| Command | Requires |
| --- | --- |
| `bun run test:integration:imports` | PostgreSQL at `DATABASE_URL` |
| `bun run test:integration:divemate-export` | PostgreSQL plus a DiveMate `.ddb` schema template |

## Import and export from the CLI

The same operations that **Settings → Integrations** and **Settings → Export**
expose are available as scripts, which is how the Helm CronJobs run them:

```bash
bun run sync:divemate                               # incremental DiveMate import
bun run import:incremental --integration=garmin     # incremental Garmin import
bun run export:divemate --output=backups/DiveMate.ddb
bun run garmin:adapter                              # start the bundled adapter
```

Full imports are deliberately UI-only because they replace source-produced
records.

## Project conventions

- `src/routeTree.gen.ts` is generated. Run `bun run generate-routes` instead of
  editing it manually.
- Server-only modules end in `.server.ts` and import
  `@tanstack/react-start/server-only`; they must never be imported from
  browser code.
- Configuration is read through `getServerEnv()` in `src/env.ts`, never from
  `process.env` directly.
- [DESIGN.md](../DESIGN.md) documents the visual system and component
  contracts; [AGENTS.md](../AGENTS.md) holds the working agreements for coding
  agents.
