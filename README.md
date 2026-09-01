# Divetracx

Divetracx is a self-hosted canonical dive log that imports from DiveMate and
Garmin. Normalized PostgreSQL tables contain the diving domain—dives, sites,
people, equipment, cylinders, gases, profiles, pictures, and certifications—
while raw source records and provenance live in a separate generic integration
layer.

## Stack

- Bun 1.3 and TypeScript 6
- TanStack Start, TanStack Router, React 19, and Tailwind CSS 4
- PostgreSQL 17, Drizzle ORM, and committed migrations
- Garmin's official FIT JavaScript SDK
- Local or S3-compatible attachment storage
- Docker and Helm deployment with optional Hodor authentication

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres
bun install --frozen-lockfile
bun run db:migrate
bun run dev
```

Open <http://localhost:3000>. **Settings → Integrations** provides capability-
driven DiveMate and Garmin controls. **Import history** reports discovered,
new, changed, unchanged, and failed source records.

Useful commands:

```bash
bun run sync:divemate
bun run import:incremental --integration=garmin
bun run export:divemate --output=backups/DiveMate.ddb
bun run verify
```

## Import model

Full and incremental imports are deliberately different:

- A full import is manual and destructive. It validates the complete source
  before transactionally replacing all integration-produced canonical records.
  Unlinked records created in Divetracx survive. A failure preserves the valid
  dataset.
- An incremental import uses stable source IDs and content hashes, skips
  unchanged records, and never deletes records merely because they disappear
  from a later source feed. Connector state advances only with a successful
  transaction.

`external_records`, `external_record_links`, `import_runs`, and
`integration_state` retain source identity, current raw data, hashes,
provenance, diagnostics, and connector-owned opaque continuation state. The
canonical domain contains no Garmin or DiveMate IDs/raw payloads.

## DiveMate

Configure `DIVEMATE_GOOGLE_DRIVE_FOLDER_ID` and
`GOOGLE_APPLICATION_CREDENTIALS`. The importer reads `DiveMate.ddb` plus
referenced `Media` and `Cards` files, using SQLite row IDs and content/file
hashes for idempotent incremental detection. Images are copied to configured
storage with immutable originals and generated thumbnails.

DiveMate export is a separate one-off operation. The configured `.ddb` is used
only as a proprietary schema template; supported tables and fixed-width profile
fields are rebuilt from canonical data. Garmin-imported and locally created
dives can therefore be exported to DiveMate. Unsupported source-only fields are
omitted predictably. The generated backup can be downloaded or explicitly
published to the configured Google Drive file from the Integrations page. Drive
publishing requires confirmation, retains the previous file revision, and is
never triggered automatically by an import or schedule.

## Garmin

Garmin supports full and incremental import and does not support export.
Activity Details supply stable Activity IDs; the official FIT SDK maps diving
sessions, profile depth/temperature, decompression ceiling, ppO₂, and gases into
the canonical model.

Transport stays behind the fail-closed adapter boundary: the app only ever talks
to the configured adapter URLs. Divetracx bundles such an adapter
(`bun run garmin:adapter`), a small server-side service that signs in to the
Garmin Connect consumer API the same way garth-based tools such as
liftosaur2garmin do. A one-time interactive login
(`bun run garmin:login`) stores OAuth tokens in `GARMIN_TOKEN_DIRECTORY` (a
persistent volume in Docker Compose and Helm); the adapter refreshes and
re-persists them on use, sweeps dive activities newest-first, downloads the
original FIT files, and returns one transactional batch with an opaque
watermark as next state. Requests must carry the shared
`GARMIN_ADAPTER_AUTHORIZATION` value. Accounts with multi-factor authentication
are not supported by the login flow yet.

A Garmin activity is reconciled against the existing logbook by start time: it
attaches to the nearest existing log entry within 45 minutes (marking it
computer-captured, filling missing fields, and adding the recorded profile and
gases only when the entry has none of its own) and only creates a new dive when
no entry matches. Matched log entries are never deleted by a Garmin full
import. See [.env.example](.env.example) and
[the architecture guide](docs/import-export-architecture.md).

## Export and data management

The **Export** page offers a DiveMate `.ddb`, versioned Divetracx JSON, joined
CSV, and UDDF 3.2.3. All are generated from canonical data and returned with
private, non-cached download headers. Exports may contain personal, health, and
location data.

The app is organized around the diver's workflow: **Dives** (the searchable
logbook, with an editor that manages tanks, buddies, gear, dive type, and shop
inline), **Sites** and **Map** (with a click-to-pin coordinate picker),
**Buddies**, **Gear**, and **Profile** (personal details, emergency contacts,
and certifications). Dive types and shops are created directly from the dive
editor, photos can be uploaded to dives and sites, and Settings offers a
chronological renumbering action. Recorded dive profiles are view-only. Import
history and external provenance remain read-only.

## Helm and scheduled imports

The chart in `charts/` deploys the app, migrations, optional Hodor gate, and
external or bundled PostgreSQL. The DiveMate CronJob performs incremental import
only and calls the same generic service as the UI/CLI. Enabling
`garminAdapter.enabled` deploys the bundled Garmin adapter with a persistent
token volume, and `garmin.sync.enabled` adds a Garmin incremental-import
CronJob; both require `garmin.existingSecret` with the shared authorization
value. Log the adapter in once with
`kubectl exec -it deploy/<release>-garmin-adapter -- bun run garmin:login`.
Garmin adapter configuration is server-only. See
[the chart guide](charts/README.md).
