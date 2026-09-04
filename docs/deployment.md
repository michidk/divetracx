# Deployment

A read-only demo build deploys to Vercel — see [demo-mode.md](demo-mode.md).

## Security boundary

Divetracx is a single-user application. It delegates authentication to the
[Hodor](https://github.com/michidk/hodor) reverse proxy rather than keeping
its own accounts or sessions. TanStack server functions are RPC endpoints and
must never be reachable around that proxy.

- Docker Compose publishes only Hodor and keeps the application container
  private.
- The Helm Service targets Hodor when enabled, and the default NetworkPolicy
  restricts ingress to the public port on application pods.
- If Hodor is disabled, provide an equivalent authenticated proxy or deploy
  only on a trusted network.
- Configure TLS in production. Helm enables secure cookies when ingress TLS is
  configured; Compose users set `HODOR_SECURE_COOKIE=true`.

The one deliberate exception is the optional MCP endpoint: `/api/mcp`,
`/oauth/*`, and the two `/.well-known/oauth-*` discovery routes must reach the
application directly, because MCP clients cannot pass an interactive cookie
gate. Those routes enforce OAuth 2.1 on every request instead. See
[MCP](#oauth-protected-mcp) below.

## Docker image

CI publishes multi-architecture images to `ghcr.io/michidk/divetracx` tagged
`latest`, `sha-<commit>`, and semantic versions for `v*` tags. Build and run
the application directly when an external database and reverse proxy already
exist:

```bash
docker build -t divetracx .
docker run --rm \
  -e DATABASE_URL="postgresql://..." \
  divetracx bun run scripts/migrate.ts
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  divetracx
```

The direct application port is unauthenticated. Put Hodor or an equivalent
gate in front of it.

## Docker Compose

`docker-compose.yaml` includes PostgreSQL 18, the application, and Hodor. Only
Hodor publishes a host port.

```bash
cp .env.example .env
# Replace HODOR_PASSWORD and HODOR_SECRET in .env.
# Generate a signing secret with: openssl rand -hex 32
docker compose up -d postgres
docker compose run --rm app bun run scripts/migrate.ts
docker compose up -d
```

Open <http://localhost:3000>.

### Enabling DiveMate

Mount the service-account JSON into the `app` container and set
`DIVEMATE_GOOGLE_DRIVE_FOLDER_ID` and `GOOGLE_APPLICATION_CREDENTIALS` in
`.env` (see [configuration.md](configuration.md#divemate)). Then run full and
incremental imports from **Settings → Integrations**, or schedule
`docker compose exec app bun run sync:divemate` with cron.

### Enabling Garmin

No Garmin-specific Docker configuration is required. Connect your account once
from **Settings → Integrations**. Divetracx stores only the resulting OAuth
tokens in PostgreSQL; passwords and verification codes are not persisted.

If upgrading from a version with the separate Garmin adapter, reconnect once:
the old adapter token volume is intentionally no longer used.

Schedule `docker compose exec app bun run import:incremental --integration=garmin`
for unattended syncs.

### Upgrading PostgreSQL from an earlier major version

PostgreSQL data volumes are tied to a major version, so a volume created by an
older image will not start under `postgres:18`. Upgrade with a dump and
restore:

```bash
# 1. Back up the whole cluster while the old image is still running.
docker compose exec postgres pg_dumpall -U divetracx > divetracx-backup.sql

# 2. Verify the backup before deleting anything.
tail -1 divetracx-backup.sql   # must end with "cluster dump complete"

# 3. Stop the stack and remove the old data volume.
docker compose down
docker volume rm "$(basename "$PWD")_divetracx-postgres"

# 4. Start PostgreSQL 18 with an empty volume and restore.
docker compose up -d postgres
docker compose exec -T postgres psql -U divetracx -d divetracx \
  < divetracx-backup.sql

# 5. Start the rest of the stack.
docker compose up -d
```

The restore reports two `already exists` errors for the bootstrap role and
database; they are harmless.

## Helm

The chart defaults to an external PostgreSQL database:

```bash
helm install divetracx ./charts \
  --set hodor.password="your-password" \
  --set hodor.secret="$(openssl rand -hex 32)" \
  --set postgresql.external.url="postgresql://divetracx:password@postgres.example:5432/divetracx"
```

For the opt-in bundled PostgreSQL StatefulSet:

```bash
helm install divetracx ./charts \
  --set hodor.password="your-password" \
  --set hodor.secret="$(openssl rand -hex 32)" \
  --set postgresql.enabled=true \
  --set postgresql.auth.password="database-password"
```

Prefer existing Kubernetes Secrets in production for the database URL
(`postgresql.existingSecret`), Hodor credentials (`hodor.existingSecret`), S3
keys (`storage.s3.existingSecret`) and the DiveMate service account
(`divemate.existingSecret`).

A migration Job runs on every install and upgrade. `sync.enabled` adds a daily
CronJob for incremental DiveMate imports, and `garmin.sync.enabled` does the
same for Garmin. All import entry points share a PostgreSQL-backed single-run
lock and the `imports.timeoutMs` deadline.

See [charts/README.md](../charts/README.md) for every value, including Secret
layouts for DiveMate.

## OAuth-protected MCP

Divetracx serves its scoped MCP endpoint itself at `/api/mcp` and derives all
OAuth URLs from the app's public origin. It ships its own OAuth 2.1
authorization server: connecting a client opens the normal Hodor-protected app,
where you approve access with your existing owner session.
It supports dynamic client registration, requires S256 PKCE and an exact
resource indicator, rotates refresh tokens with replay detection, stores codes
and refresh tokens only as hashes, and supports immediate revocation. The
signing key is derived from `HODOR_SECRET`, which must be at least 32
characters.

Docker Compose routes the MCP and OAuth paths past Hodor out of the box. In
Helm, `mcp.enabled` adds them to Hodor's `BYPASS_PATHS`, so they are served over
the normal application host without a second Ingress:

```yaml
mcp:
  enabled: true
  allowedOrigins:
    - https://chatgpt.com
```

Machine endpoints — the protocol endpoint, OAuth discovery, registration, token,
and revocation — skip the login form; the protocol endpoint still requires OAuth
on every request. `/oauth/authorize` stays behind Hodor, because that is where
the owner approves a client. For browser-based MCP clients,
`MCP_ALLOWED_ORIGINS` adds an explicit Origin allowlist.

After deployment, use **Settings → AI access** to pause or resume MCP, enable
or disable each read, write, and delete tool, inspect granted client scopes,
revoke clients, and review recent activity. The Helm switch only creates the
path-limited route around Hodor; it does not configure or run another MCP
server.

Connect a client:

```bash
codex mcp add divetracx --url https://dives.example.com/api/mcp
codex mcp login divetracx
```

Tool results can contain private health, location, contact, and certification
data. Write access is explicit on the OAuth consent screen, delete access is a
separate scope, and both remain subject to the per-tool owner policy.

## Storage

Local storage keeps immutable originals and generated WebP thumbnails under
`STORAGE_PATH`. Prefer S3-compatible storage (`STORAGE_PROVIDER=s3`) when the
application runs with more than one replica or when uploads should outlive the
node. `bun run media:refresh-thumbnails` regenerates thumbnails after changing
thumbnail settings or restoring originals from a backup.
