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
**Settings → DiveMate sync**.

## DiveMate synchronization

The importer downloads the configured `.ddb` backup, verifies that it is a
SQLite database, parses it read-only, and transactionally upserts supported
records. It currently maps DiveMate logbook entries, places, buddies,
equipment, tanks, shops, and certifications. Unmapped source fields are kept in
JSONB so migration can become more complete without re-reading an old backup.

Sync never deletes a Divetracx record merely because it disappeared from a
later backup. This protects manual edits and makes repeated imports safe.

The DiveMate backup contains personal data. Prefer a private authenticated URL;
do not commit a real backup URL or `.ddb` file.
