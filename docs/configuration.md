# Configuration

Divetracx reads all server configuration from environment variables. The
schema lives in `src/env.ts` and is validated with T3 Env and Zod lazily on
first use, so Docker images build without runtime secrets. Empty values are
treated as unset, allowing documented defaults to apply. Invalid or incomplete
configuration fails with the affected variable names and never prints secret
values.

[`.env.example`](../.env.example) lists every variable with a short comment.

## Database and imports

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | — | Yes | PostgreSQL connection URL |
| `IMPORT_TIMEOUT_MS` | `900000` | No | Hard timeout for any import run (15 minutes) |

Every import entry point — UI, CLI, and scheduled Job — shares a
PostgreSQL-backed single-run lock and the same timeout.

## DiveMate

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `DIVEMATE_GOOGLE_DRIVE_FOLDER_ID` | — | For DiveMate | Drive folder that holds `DiveMate.ddb`, `Media`, and `Cards` |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | For DiveMate | Path to a service-account JSON with read access to that folder |
| `DIVEMATE_MAX_BACKUP_BYTES` | `52428800` | No | Largest accepted `.ddb` (50 MiB) |
| `DIVEMATE_MAX_IMAGE_BYTES` | `104857600` | No | Largest accepted media file (100 MiB) |

Viewer access to the folder is enough for imports and for using the backup as
a schema template when exporting. Publishing an export back to Drive needs
write access to the file.

## Garmin (application side)

The application never talks to Garmin directly. It calls an adapter over HTTP
and authenticates with a shared secret sent as the complete `Authorization`
header.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `GARMIN_ADAPTER_FULL_IMPORT_URL` | — | For Garmin | Adapter endpoint for full imports |
| `GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL` | — | For Garmin | Adapter endpoint for incremental imports |
| `GARMIN_ADAPTER_AUTHORIZATION` | — | For Garmin | Full `Authorization` header value, e.g. `Bearer …` |
| `GARMIN_ADAPTER_TIMEOUT_MS` | `30000` | No | Per-request adapter timeout |
| `GARMIN_ADAPTER_MAX_RESPONSE_BYTES` | `104857600` | No | Largest accepted adapter response (100 MiB) |
| `GARMIN_MAX_FIT_BYTES` | `26214400` | No | Largest accepted FIT file (25 MiB) |

## Garmin adapter (adapter side)

Read by `scripts/garmin-adapter.ts`, which Docker Compose starts under the
`garmin` profile and the Helm chart deploys when `garminAdapter.enabled` is set.

| Variable | Default | Description |
| --- | --- | --- |
| `GARMIN_ADAPTER_PORT` | `8787` | Listening port |
| `GARMIN_ADAPTER_AUTHORIZATION` | — | Must match the application-side value; requests without it are rejected |
| `GARMIN_TOKEN_DIRECTORY` | `/data/garmin-tokens` | Persistent directory for Garmin Connect OAuth tokens |
| `GARMIN_DOMAIN` | `garmin.com` | Garmin Connect domain (`garmin.cn` for China) |
| `GARMIN_ACTIVITY_PAGE_SIZE` | `50` | Activities fetched per page |
| `GARMIN_FULL_IMPORT_MAX_ACTIVITIES` | `2000` | Upper bound for a full import |
| `GARMIN_INCREMENTAL_OVERLAP_SECONDS` | `3600` | Look-back window so late-synced activities are not missed |
| `GARMIN_MFA_CHALLENGE_TTL_SECONDS` | `300` | How long a pending MFA login challenge stays valid |

Passwords and verification codes are forwarded once and never persisted; only
the resulting OAuth tokens are written to `GARMIN_TOKEN_DIRECTORY`.

## Model Context Protocol

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `MCP_ALLOWED_ORIGINS` | — | No | Comma-separated Origin allowlist for browser-based MCP clients |
| `HODOR_SECRET` | — | Yes | Also used to derive the OAuth signing key; must be at least 32 characters |

Divetracx derives its MCP endpoint from its own public origin and serves it at
`/api/mcp`; no separate MCP URL is configured. Runtime access is managed in
**Settings → AI access**, including the master switch, every individual tool,
client revocation, granted scopes, and audit activity.

## Media storage

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `STORAGE_PROVIDER` | `local` | No | `local` or `s3` |
| `STORAGE_PATH` | `./uploads` | No | Upload root for local storage |
| `STORAGE_URL` | `/media` | No | Public URL base for media |
| `S3_BUCKET` | — | For S3 | Bucket name |
| `S3_REGION` | `us-east-1` | No | Bucket region |
| `S3_ENDPOINT` | — | No | Custom endpoint for S3-compatible stores |
| `S3_ACCESS_KEY_ID` | — | For S3 | Access key |
| `S3_SECRET_ACCESS_KEY` | — | For S3 | Secret key |

## Hodor (Docker Compose only)

These are consumed by the Hodor container in `docker-compose.yaml`; the Helm
chart maps its own `hodor.*` values instead.

| Variable | Default | Description |
| --- | --- | --- |
| `HODOR_PASSWORD` | — | Login password (required) |
| `HODOR_SECRET` | — | Session signing secret (required; `openssl rand -hex 32`) |
| `HODOR_PORT` | `3000` | Published host port |
| `HODOR_TITLE` | `Divetracx Login` | Login page title |
| `HODOR_SESSION_TTL` | `86400` | Session lifetime in seconds |
| `HODOR_SECURE_COOKIE` | `false` | Set `true` behind TLS |
| `HODOR_LOG_FORMAT` | `compact` | Hodor log format |

## Build-time variables

`VITE_HEAD_HTML` is the only browser-visible variable. Vite inlines it into
every HTML document before `</head>` when the application is built, so it
cannot be changed at container runtime. It accepts complete tags such as an
analytics `<script>` or a site-verification `<meta>`. Treat it as trusted
executable configuration and never populate it from user input.

`DIVETRACX_EDITION` (`standard` or `demo`) selects the edition at build time;
see [Read-only demo mode](demo-mode.md).
