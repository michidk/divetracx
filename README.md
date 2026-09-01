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
- Local or S3-compatible picture storage
- Zod-validated server configuration
- Docker and Helm deployment with optional Hodor authentication

## Quick start

```bash
cp .env.example .env
# Configure the private Google Drive folder and service-account credential.
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

## Data management

The **Data** menu lists dives, sites, divers, buddies, equipment,
certifications, shops, dive types, tanks, and synchronization history. Each
mutable collection supports creating manual records and editing existing ones.
Dive editors also manage the buddy and equipment relationship tables.

Synchronization history is intentionally read-only. Records imported from
DiveMate can be edited, but their editor warns when source-owned fields may be
refreshed by a later synchronization.

## DiveMate synchronization

The importer downloads the configured `.ddb` backup, verifies that it is a
SQLite database, parses it read-only, and transactionally upserts supported
records. It currently maps DiveMate logbook entries, places, buddies,
equipment, tanks, shops, certifications, and pictures. When a Google Drive
folder is configured, the importer recursively reads `DiveMate.ddb` and resolves
referenced originals from its `Media` and `Cards` folders. Embedded
`Pictures.Graphic` bytes remain supported as a fallback. Images are copied into
configured local or S3-compatible storage while the original DiveMate device
path remains unchanged for future
round-trip export. The stored original bytes are immutable; the dive gallery
uses a separate generated WebP thumbnail and opens the original in a lightbox.
Unmapped source fields are kept in
JSONB so migration can become more complete without re-reading an old backup.

Enable the Google Drive API, share the backup folder with a service account,
and configure `DIVEMATE_GOOGLE_DRIVE_FOLDER_ID` plus
`GOOGLE_APPLICATION_CREDENTIALS`. Google Drive service-account access is the
only supported DiveMate synchronization source.

Automatic and scheduled synchronization imports from Drive only. The settings
page also provides an explicit **Push edits to Drive** action. It updates fields
on records originally imported from DiveMate while preserving unknown columns,
profile binaries, and original media paths. Google Drive retains the previous
`DiveMate.ddb` revision. Divetracx-only records without a DiveMate external ID
are skipped rather than assigned speculative IDs.

Sync never deletes a Divetracx record merely because it disappeared from a
later backup. This protects manual edits and makes repeated imports safe.

## Helm and scheduled synchronization

The chart in `charts/` deploys the application, database migrations, optional
Hodor authentication, and external or bundled PostgreSQL. Set
`sync.enabled=true` after configuring the DiveMate backup Secret to run the
same idempotent importer every day at 03:00 UTC. See
[the chart documentation](charts/README.md) for values and installation
examples.

The DiveMate backup contains personal data. Keep the service-account credential
out of source control and grant it access only to the required Drive folder.
