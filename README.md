# Divetracx

Divetracx is a self-hosted dive log and DiveMate migration target. It keeps a
normalized PostgreSQL record of dives, sites, buddies, equipment, tanks, and
certifications while retaining the original DiveMate payload for fields the UI
does not understand yet.

## Stack

- Bun 1.3 and TypeScript 6
- TanStack Start and TanStack Router
- React 19 and Tailwind CSS 4
- PostgreSQL 17, Drizzle ORM, and committed migrations
- Zod-validated server configuration
- Docker and Helm deployment with optional Hodor authentication

## Quick start

```bash
cp .env.example .env
# Set DIVEMATE_BACKUP_URL to a direct or Google Drive file URL.
docker compose up -d postgres
bun install --frozen-lockfile
bun run db:migrate
bun run sync:divemate
bun run dev
```

Open <http://localhost:3000>. Synchronization can also be triggered from
**Settings → DiveMate sync**. The **Sync logs** menu shows manual, scheduled,
and command-line attempts with their imported counts and failures.

## Data export

The **Export** menu provides three direct downloads:

- a complete, versioned Divetracx JSON backup;
- a UTF-8 CSV with one joined row per dive; and
- a UDDF 3.2.3 document for compatible dive-log applications.

Export responses are private and never cached. They can contain personal and
location data, so store downloaded files securely. Divetracx does not generate
DiveMate's proprietary `.ddb` format; use UDDF for interoperability and JSON
for a lossless Divetracx backup.

## DiveMate synchronization

The importer downloads the configured `.ddb` backup, verifies that it is a
SQLite database, parses it read-only, and transactionally upserts supported
records. It currently maps DiveMate logbook entries, places, buddies,
equipment, tanks, shops, and certifications. Unmapped source fields are kept in
JSONB so migration can become more complete without re-reading an old backup.

Sync never deletes a Divetracx record merely because it disappeared from a
later backup. This protects manual edits and makes repeated imports safe.

## Helm and scheduled synchronization

The chart in `charts/` deploys the application, database migrations, optional
Hodor authentication, and external or bundled PostgreSQL. Set
`sync.enabled=true` after configuring the DiveMate backup Secret to run the
same idempotent importer every day at 03:00 UTC. See
[the chart documentation](charts/README.md) for values and installation
examples.

The DiveMate backup contains personal data. Prefer a private authenticated URL;
do not commit a real backup URL or `.ddb` file.
