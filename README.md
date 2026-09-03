# Divetracx

[![Checks and Build](https://github.com/michidk/divetracx/actions/workflows/ci.yml/badge.svg)](https://github.com/michidk/divetracx/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**The self-hosted dive log you actually own.** Divetracx imports your history
from DiveMate and Garmin, normalizes it into one canonical logbook — dives,
sites, buddies, equipment, cylinders, gases, profiles, pictures, and
certifications — and keeps every record on your own PostgreSQL and storage.

**[Try the read-only demo](https://divetracx.vercel.app/)** — seven anonymized
sample dives with complete profiles, running in an ephemeral, database-free
PGlite instance.

![Divetracx overview with logbook statistics and recent dives](.github/images/overview.webp)

Dive computers, phone apps, and exchange formats each keep their own copy of
your dives, with their own schemas and their own gaps. Divetracx pulls them
together: run a full historical import once, then let incremental syncs pick up
new dives with stable source identities and change detection. Source records
and provenance stay in a separate integration layer, so the canonical model
contains no vendor IDs or raw payloads and your manual edits survive every
re-import.

## Why Divetracx

- **Import from multiple sources.** DiveMate `.ddb` backups (with photos and
  certification cards) and Garmin dive computers via the official FIT SDK.
- **Reliable ongoing sync.** Full imports are manual, validated, and
  transactional; incremental imports skip unchanged records and never delete a
  dive just because it disappeared from a later feed.
- **One canonical record.** Different source schemas map into one durable
  model with full provenance, while records you created by hand stay intact.
- **Complete dive detail.** Profiles, tanks, gases, pressure, temperature,
  decompression ceiling, ppO₂, notes, ratings, and media in one place.
- **The whole logbook.** Dives connect to sites, buddies, shops, equipment,
  and certifications; photos attach to dives and sites.
- **Maps and statistics.** Interactive profiles, a site map with a
  click-to-pin coordinate picker, calendar activity, trends, personal records,
  and aggregate statistics.
- **Your data, portable.** Export to DiveMate `.ddb`, UDDF 3.2.3, CSV, or
  versioned Divetracx JSON at any time.
- **Ask your agent.** An optional OAuth-protected, read-only MCP endpoint lets
  your own AI tools search dives, load details, list sites, and read
  statistics.
- **Yours, end to end.** Self-hosted on your own PostgreSQL and your own
  storage, behind your own auth proxy. No accounts, no telemetry.
- **Deploys in one command.** Docker Compose for a home server, a Helm chart
  for a cluster.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src=".github/images/dive-detail.webp" alt="Dive detail page with a depth and temperature profile and a tank-switch marker"></td>
    <td width="50%"><img src=".github/images/dives.webp" alt="Searchable dive table with type, site, date, time, depth, and water temperature"></td>
  </tr>
  <tr>
    <td align="center"><sub>Dive detail with computer profile</sub></td>
    <td align="center"><sub>Searchable logbook</sub></td>
  </tr>
  <tr>
    <td><img src=".github/images/stats.webp" alt="Statistics page with time underwater, depth, and a depth-over-time chart"></td>
    <td><img src=".github/images/profile.webp" alt="Diver profile with certifications and a generated share card"></td>
  </tr>
  <tr>
    <td align="center"><sub>Statistics</sub></td>
    <td align="center"><sub>Profile and shareable diver card</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src=".github/images/sites.webp" alt="Dive sites table with dive counts, deepest dive, last dive, and rating"></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><sub>Dive sites</sub></td>
  </tr>
</table>

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime and package manager | Bun 1.4 |
| Full-stack framework | TanStack Start with server functions |
| Routing | TanStack Router, file-based and fully typed |
| UI | React 19, shadcn/ui, Base UI, Tailwind CSS v4 |
| Icons and maps | Lucide, MapLibre GL |
| Database | PostgreSQL 18 with Drizzle ORM and committed migrations; ephemeral PGlite for the demo |
| Media storage | Local filesystem or any S3-compatible bucket |
| Dive computer data | Garmin's official FIT JavaScript SDK |
| Validation | Zod at every boundary, including environment variables |
| Tooling | Vite, Biome, Knip, `bun test` |
| Deployment | Docker Compose or Helm, fronted by the Hodor auth proxy |

Server-only concerns — database access, storage providers, Google Drive and
Garmin transport, and secrets — never cross into browser code.

## Quick start with Docker Compose

```bash
cp .env.example .env
# Replace HODOR_PASSWORD and HODOR_SECRET in .env.
# Generate a signing secret with: openssl rand -hex 32
docker compose up -d postgres
docker compose run --rm app bun run scripts/migrate.ts
docker compose up -d
```

Open <http://localhost:3000>. **Settings → Integrations** provides
capability-driven DiveMate and Garmin controls, and **Import history** reports
discovered, new, changed, unchanged, and failed source records.

## Local development

Divetracx uses Bun 1.4.0. With PostgreSQL available at the `DATABASE_URL` from
`.env`:

```bash
bun install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
bun run db:migrate
bun run dev
```

The unauthenticated development server listens on <http://localhost:3000>. It
applies pending migrations before startup and watches for newly generated
migrations.

## Common commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Apply migrations and start the watched development server |
| `bun run check` | Check source formatting and lint |
| `bun run typecheck` | Run TypeScript without emitting files |
| `bun run test` | Run tests; environment-gated integration suites are skipped |
| `bun run lint:deadcode` | Find unused code and dependencies with Knip |
| `bun run build` | Build production assets |
| `bun run build:demo` | Build the database-free Vercel demo |
| `bun run check:helm` | Lint and template the Helm chart |
| `bun run verify` | Run the complete local quality gate |
| `bun run db:generate` | Generate a Drizzle migration after a schema change |
| `bun run db:migrate` | Apply committed migrations |
| `bun run db:seed` | Seed the same fictional dataset as the public demo |
| `bun run sync:divemate` | Run an incremental DiveMate import |
| `bun run import:incremental --integration=garmin` | Run an incremental Garmin import |
| `bun run export:divemate --output=backups/DiveMate.ddb` | Rebuild a DiveMate backup from canonical data |

## Integrations

### DiveMate

Configure `DIVEMATE_GOOGLE_DRIVE_FOLDER_ID` and `GOOGLE_APPLICATION_CREDENTIALS`
for a service account with read access to the Drive folder holding your
backup. The importer reads `DiveMate.ddb` plus referenced `Media` and `Cards`
files, using SQLite row IDs and content hashes for idempotent incremental
detection. Images are copied to configured storage with immutable originals
and generated WebP thumbnails.

DiveMate export is a separate, explicit operation: the configured `.ddb` is
used only as a schema template, and supported tables are rebuilt from canonical
data, so Garmin-imported and locally created dives can be exported too. The
generated backup can be downloaded or published to the configured Drive file
from the Integrations page; publishing requires confirmation and is never
triggered automatically.

### Garmin

Garmin supports full and incremental import. The app never talks to Garmin
directly; it calls a fail-closed adapter that Divetracx bundles
(`bun run garmin:adapter`, or the `garmin` Compose profile). Connect your
Garmin account once from **Settings → Integrations**: credentials are forwarded
server-to-server, the adapter logs in (with MFA support) and keeps only the
resulting OAuth tokens on a persistent volume. Activities are reconciled
against existing log entries by start time within 45 minutes, so a
computer-recorded profile attaches to the dive you already logged instead of
creating a duplicate.

### Model Context Protocol

Set `MCP_SERVER_URL` (for example `https://dives.example.com/api/mcp`) to
enable a read-only MCP endpoint that lets your own AI tools search dives, load
bounded dive details, list sites, and read aggregate statistics. Divetracx
ships its own OAuth 2.1 authorization server, so no external identity provider
is needed: connecting a client opens the normal Hodor-protected app, where you
approve access with your existing owner session. The server supports dynamic
client registration, requires S256 PKCE and an exact resource indicator,
rotates refresh tokens with replay detection, stores codes and refresh tokens
only as hashes, and supports immediate revocation. Its signing key is derived
from `HODOR_SECRET`, which must be at least 32 characters.

`/api/mcp`, `/oauth/*`, and the two `/.well-known/oauth-*` discovery routes
must reach Divetracx directly, bypassing Hodor's cookie gate; every other path
stays behind Hodor. Docker Compose does this out of the box, and the Helm chart
creates a path-limited Service and Ingress when `mcp.enabled` and
`mcp.ingress.enabled` are set. Then connect a client:

```bash
codex mcp add divetracx --url https://dives.example.com/api/mcp
codex mcp login divetracx
```

Tool results can contain private health, location, contact, and certification
data, so the endpoint stays disabled unless `MCP_SERVER_URL` is configured.

## Configuration

All server configuration comes from environment variables, validated with Zod
on first use. [`.env.example`](.env.example) lists every variable with its
default and a short description; the groups are `DATABASE_URL` and import
limits, DiveMate (`DIVEMATE_*`, `GOOGLE_APPLICATION_CREDENTIALS`), Garmin
(`GARMIN_ADAPTER_*` on the app side, `GARMIN_*` on the adapter side), MCP
(`MCP_SERVER_URL`, `MCP_ALLOWED_ORIGINS`), storage (`STORAGE_*`, `S3_*`), and
the Compose-only Hodor gate (`HODOR_*`).

The only browser-visible variable is the build-time `VITE_HEAD_HTML`, which is
inlined verbatim before `</head>` for analytics or site-verification tags.
Treat it as trusted executable configuration.

## Deployment

Divetracx is a single-user application. It delegates authentication to the
[Hodor](https://github.com/michidk/hodor) reverse proxy rather than keeping
its own accounts, and TanStack server functions are RPC endpoints that must
never be reachable around that proxy. Docker Compose publishes only Hodor; the
Helm chart points its Service at Hodor and ships a NetworkPolicy that limits
ingress to the public port. If you disable Hodor, put an equivalent
authenticated proxy in front or deploy on a trusted network only. Configure TLS
in production — Helm turns on secure cookies automatically when ingress TLS is
set; Compose users set `HODOR_SECURE_COOKIE=true`.

CI publishes multi-architecture images to `ghcr.io/michidk/divetracx` tagged
`latest`, `sha-<commit>`, and semantic versions for `v*` tags. For Kubernetes:

```bash
helm install divetracx ./charts \
  --set hodor.password="your-password" \
  --set hodor.secret="$(openssl rand -hex 32)" \
  --set postgresql.external.url="postgresql://divetracx:password@postgres.example:5432/divetracx"
```

Set `postgresql.enabled=true` for the bundled StatefulSet instead, and prefer
existing Kubernetes Secrets for the database URL, Hodor credentials, S3 keys,
the DiveMate service account, and the Garmin adapter authorization. A migration
Job runs on every install and upgrade, and optional CronJobs run incremental
DiveMate and Garmin imports. See [charts/README.md](charts/README.md) for every
value.

PostgreSQL data volumes are tied to a major version. Before moving an existing
installation to PostgreSQL 18, dump with `pg_dumpall`, start a fresh volume,
and restore.

## Read-only demo

`bun run build:demo` compiles the demo edition (`DIVETRACX_EDITION=demo`) and
emits Vercel Build Output with an ephemeral PGlite database restored from a
snapshot of every committed migration plus the fictional fixtures that
`bun run db:seed` also loads. The edition is baked into the bundles, so no
runtime variable can turn a production build into a demo or vice versa.
Server middleware rejects every non-GET request, and the UI shows a persistent
read-only banner. The fixture holds seven dives with real-shaped but fully
anonymized profiles, five fictional sites, three fictional buddies, and no
contact, insurance, certification-number, or provenance data.

## Architecture at a glance

```text
src/routes/          TanStack Router file routes and API endpoints
src/components/      Shared application UI and shadcn/ui primitives
src/modules/         Domain modules: dives, sites, gear, export, media, profile, …
src/modules/mcp/           Read-only MCP tools and the built-in OAuth 2.1 server
src/modules/integrations/  Generic import service, runs, and provenance
src/modules/divemate/      DiveMate .ddb reader, mapper, and writer
src/modules/garmin/        Garmin FIT mapping and adapter client
src/modules/garmin-adapter/ Bundled Garmin Connect adapter service
src/db/              Drizzle schema and database connection
drizzle/             Committed migrations and metadata
scripts/             CLI entry points: migrate, seed, sync, export, adapter
charts/              Helm chart
```

`src/routeTree.gen.ts` is generated. Run `bun run generate-routes` instead of
editing it manually. [DESIGN.md](DESIGN.md) documents the visual system and
component contracts.

## License

[MIT](LICENSE)
