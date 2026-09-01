# Generic import and export architecture

## Current state

Divetracx already stores most useful dive-log concepts in normalized PostgreSQL
tables: divers, sites, buddies, equipment, certifications, shops, dive types,
dives, profile samples, cylinders (`tanks`), media, and dive relationships. The
current DiveMate parser is deliberately read-only, preserves unknown SQLite
columns as JSON, uses stable source table IDs, and maps linked records before a
single PostgreSQL transaction. Those are good foundations to retain.

The source boundary is currently in the wrong place. Every canonical table
contains `source_key`, external identifiers, timestamps, and raw payloads. Some
canonical columns (`source_value_*`, source coordinate strings, and numeric
DiveMate type codes) describe DiveMate's storage rather than the diving domain.
The importer reads and upserts an entire backup on every run, even if records are
unchanged. `sync_runs` cannot distinguish a destructive full import from an
incremental import and does not report created, updated, unchanged, or failed
records separately.

DiveMate export is an explicit manual operation, but it currently edits only
records already present in the downloaded source database. It skips manual and
non-DiveMate canonical data and therefore is not a canonical export.

There is no existing Garmin implementation. Garmin's public Activity API page
confirms REST, push, and ping/pull delivery, Activity Details, and FIT/GPX/TCX
activity files. Partner authentication endpoints, scopes, delivery contracts,
rate limits, and production credentials are available only after Garmin Connect
Developer Program approval. Divetracx must not guess those gated details.

## Feedback loop

Run focused checks while changing a module, then the repository verification:

```bash
bun run check
bun run typecheck
bun test src/modules/integrations
bun test src/modules/divemate
bun test src/modules/garmin
bun run verify
```

Schema changes are additionally applied to PostgreSQL with `bun run db:migrate`.
Runtime or Helm changes require `docker build .` and `bun run check:helm`.

## Module map

| Module | Responsibility | Current entry points | Main coupling risk |
| --- | --- | --- | --- |
| Canonical data | Dive-domain persistence and generic editing | `src/db/schema.ts`, `src/modules/data` | Source metadata is mixed into domain rows |
| Import orchestration | Run lifecycle, full replacement, incremental classification, state | currently embedded in DiveMate sync | Cannot be reused and cannot distinguish modes |
| DiveMate connector | Google Drive backup access, SQLite parsing, media, mapping, `.ddb` export | `src/modules/divemate` | Directly owns canonical SQL and run history |
| Garmin connector | Approved Activity API transport, Activity Details/FIT mapping | absent | Gated API details must not be invented |
| Generic exports | JSON, CSV, and UDDF from canonical data | `src/modules/export` | Snapshot still exposes source columns and sync history |
| Integration UI | Manual full/incremental imports, capability/status/history | `/settings/sync` | UI is named and shaped exclusively for DiveMate |

## Canonical and provenance schema

### `integrations`

Built-in connector identity and declared capabilities. Capability metadata is
descriptive; the connector registry remains the executable implementation.

- `key` text primary key (`divemate`, `garmin`)
- `display_name`
- `capabilities` JSONB (`fullImport`, `incrementalImport`, `export`)
- `supported_entities` JSONB
- audit timestamps

### `import_runs`

- UUID primary key
- integration foreign key
- mode: `full` or `incremental`
- trigger: `manual`, `schedule`, or `cli`
- status: `pending`, `running`, `succeeded`, `partially_failed`, or `failed`
- started/finished timestamps
- explicit discovered/created/updated/skipped/failed counters
- source fingerprint, diagnostics JSONB, and safe error text

Existing `sync_runs` are copied to incremental `import_runs` during migration.

### `integration_state`

One row per integration with connector-owned JSONB state and the last successful
run. Garmin may store partner-provided continuation/backfill state. DiveMate stores
the last successful backup identity; its incremental detection still compares
stable row IDs and hashes because a backup has no API cursor.

State is written only in the same transaction that marks an import successful.

### `external_records`

- UUID primary key
- integration, source entity type, and stable external identifier
- current structured raw JSONB representation
- optional file metadata JSONB (path, checksum, size, MIME type, storage key)
- SHA-256 content hash
- first/last seen and processed timestamps
- optional external created/updated timestamps
- first/last observing import run
- mapper version and processing error
- unique integration + entity type + external identifier

An unchanged observation updates only `last_seen_at` and its last run. A changed
observation replaces the current raw representation and is remapped. The table
shape permits a later append-only versions table without changing canonical
tables.

### `external_record_links`

Generic provenance from an external record to one or more canonical UUIDs:

- external record foreign key
- canonical entity type and UUID
- link role (`produced` by default)
- audit timestamp

No canonical table receives Garmin- or DiveMate-specific IDs.

## Connector interface

Code outside a connector uses these operations:

```ts
performFullImport(integration, { trigger: 'manual' })
performIncrementalImport(integration, { trigger })
exportIntegration(integration)
```

Each connector exposes a compact descriptor and prepares a validated batch:

```ts
interface IntegrationConnector {
  descriptor: IntegrationDescriptor
  prepareImport(context: PrepareImportContext): Promise<PreparedImport>
  applyImport(context: ApplyImportContext): Promise<CanonicalChangeCounts>
  export?(context: ExportContext): Promise<IntegrationExport>
}
```

`prepareImport` performs remote/file IO and parsing before a destructive full
import transaction starts. `applyImport` receives classified source changes and
the transaction-owned provenance resolver. Connector internals may map entities
in dependency order, but may not create or finalize run/state rows themselves.

Full import is not implemented as cursorless incremental import. It validates a
complete batch, opens one replacement transaction, deletes canonical records with
external provenance (leaving unlinked manual records), rebuilds external records
and links, establishes connector state, and commits. A failure rolls back the
replacement and the valid prior dataset remains.

Incremental import never deletes missing source rows. Matching order is existing
external record, stable external identifier, then an explicit non-ambiguous
connector heuristic if a source truly lacks an identifier. Ambiguity is an error,
not a silent merge.

## Filesystem changes and boundaries

```text
src/modules/integrations/
  types.ts
  registry.ts
  server/import-service.server.ts
  server/import-repository.server.ts
  server/imports.ts
  *.test.ts

src/modules/divemate/
  parser.ts
  types.ts
  server/connector.server.ts
  server/exporter.server.ts
  server/google-drive.server.ts

src/modules/garmin/
  activity-details.ts
  fit.ts
  types.ts
  server/client.server.ts
  server/connector.server.ts
```

Routes import generic server-function adapters. Generic integration code never
imports a connector internal; the registry is the composition root. Connectors
may depend on the canonical schema and generic public types, never on routes or
each other. Existing folder routes and hyphen-prefixed route-private components
remain unchanged.

These rules are initially enforced by import conventions and focused architecture
tests. A repository-wide module barrel is not introduced; consumers use concrete
public contract files.

## DiveMate decisions

- SQLite `ID` is the stable external identifier. `UUID` and `Updated` remain raw
  metadata but are not required for identity.
- Hash normalized source rows and relevant file checksums. The `Logbook` row is
  the external dive/profile record; derived profile samples do not pretend to be
  independent source rows.
- An incremental backup is fully inspected, but unchanged hashes skip canonical
  writes. Missing rows remain untouched.
- Media bytes remain in object storage; external records keep path, MIME type,
  size, checksum, and storage reference rather than embedding binary JSON.
- `.ddb` export starts from a compatible schema template, clears supported source
  collections, and writes all supported canonical records. The template supplies
  a proprietary schema, not source-of-truth data. Canonical-only records receive
  deterministic export-time IDs and UUIDs, and supported profiles are encoded.

## Garmin decisions

- Use Garmin Activity ID as the external dive identity.
- Store the Activity Details representation and FIT file metadata/checksum as the
  raw source record. Parse detailed dive fields and samples from the FIT activity
  using Garmin's official JavaScript FIT SDK.
- Accept only Garmin activity/sub-sport values that the FIT profile identifies as
  diving. Other fitness activities are discovered but skipped with diagnostics.
- The approved API adapter owns OAuth refresh, rate-limit handling, feed/backfill
  requests, and partner continuation state. Endpoints, scopes, and delivery mode
  are deployment configuration obtained from Garmin, not hard-coded guesses.
- Full import requests/consumes the approved historical backfill. Incremental
  import consumes only the continuation/feed items delivered since the stored
  successful state. A failed run never advances that state.
- Garmin declares no export capability.

### Approved transport adapter contract

This is a Divetracx deployment boundary, not a claim about Garmin's gated HTTP
contract. Both configured adapter URLs receive a server-to-server `POST` with:

```json
{ "mode": "full", "state": {} }
```

The adapter completes Garmin OAuth, rate-limit handling, backfill/pagination or
continuation work and returns one complete transactional batch:

```json
{
  "activities": [
    {
      "activityDetails": { "ActivityId": 12345, "Summary": {} },
      "fitBase64": "optional FIT bytes",
      "fitFileName": "12345.fit",
      "fitContentType": "application/vnd.ant.fit"
    }
  ],
  "nextState": { "partnerContinuation": "opaque" },
  "sourceDescription": "approved Garmin backfill page set",
  "diagnostics": {}
}
```

`nextState` is persisted verbatim only after canonical writes succeed. Response
and FIT byte limits, timeout, authorization header, and URLs are server-only
configuration. HTTP 429/other failures retain the existing state; `Retry-After`
is recorded in the run error rather than guessed into a local timestamp cursor.

## Test strategy

Boundary tests cover:

- connector capability declarations and unsupported operations;
- unchanged, new, and changed external record classification;
- repeated incremental import idempotency;
- state advancement only on successful commit;
- successful full replacement and rollback on failure;
- provenance lookup from an imported dive;
- DiveMate stable-ID/hash behavior and canonical `.ddb` export;
- Garmin Activity ID/FIT mapping without DiveMate assumptions;
- canonical Garmin data passed to the DiveMate exporter.

Pure classification/mapping tests use deterministic fixtures. PostgreSQL
integration tests validate transaction and migration behavior. Live Google Drive
and Garmin partner environments stay opt-in.

## Incremental migration

1. Add generic tables and backfill existing DiveMate source columns while the old
   importer still works.
2. Add and contract-test generic run/provenance orchestration.
3. Move DiveMate imports behind the connector, preserving existing scheduled and
   manual entry points as compatibility adapters.
4. Switch editors/status/export consumers to provenance and `import_runs`; remove
   canonical source columns and DiveMate-only values.
5. Rebuild DiveMate export from canonical data.
6. Add Garmin Activity Details/FIT mapping and the approved API adapter boundary.
7. Replace the DiveMate-only settings page with capability-driven integration UI,
   requiring an explicit confirmation phrase for destructive full imports.
8. Verify migrations, contracts, Helm, browser behavior, and the production image.

## Implemented result

The staged schema transition is implemented in migrations `0012` through `0015`.
`0012` introduces and backfills generic integration, run, state, external
record, and provenance tables. `0013` removes source IDs, raw payloads, source
keys, coordinate strings, and DiveMate-only value codes from canonical tables.
Dive relationships receive canonical UUIDs so association provenance no longer
requires a source column; `0014` removes the migrated legacy `sync_runs` table,
and `0015` permits independently provenanced samples at the same source index.

DiveMate and Garmin implement the same small connector contract. The generic
service owns explicit full replacement, incremental classification, run/state
transactions, provenance, capability-driven UI, and history. DiveMate `.ddb`
export is rebuilt from the canonical snapshot. Garmin uses Activity Details and
the official FIT SDK while gated partner transport stays behind a configurable,
fail-closed adapter boundary.

Users can download a one-off DiveMate export or explicitly publish it over the
configured `DiveMate.ddb` in Google Drive. Publishing requires confirmation,
retains the previous Drive revision, and is never invoked by an import or
schedule; it is an export destination, not bidirectional synchronization.
