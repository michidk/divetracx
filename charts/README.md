# Divetracx Helm chart

This chart deploys Divetracx, an optional Hodor authentication sidecar, database
migrations, and either external or bundled PostgreSQL. It can also create a
daily CronJob that incrementally imports the configured DiveMate backup.

## DiveMate backup Secret

Create a service account, share the DiveMate folder with it, and store its downloaded
JSON credential in a Secret:

```bash
kubectl create secret generic divetracx-divemate \
  --from-file=google-credentials.json=/secure/path/divetracx-service-account.json
```

```yaml
divemate:
  existingSecret: divetracx-divemate
  googleDriveFolderId: your-drive-folder-id
  googleCredentialsSecretKey: google-credentials.json

sync:
  enabled: true
```

The credential is mounted read-only and never stored in Helm values. Viewer
access is sufficient for imports and for using the database as a schema
template for a manual canonical `.ddb` export.

The CronJob uses `concurrencyPolicy: Forbid` by default and records its runs as
`schedule`. The application receives the same Secret, so **Sync now** uses the
same importer and records runs as `manual`. All import entry points share a
PostgreSQL-backed single-run lock. They time out after `imports.timeoutMs`
(15 minutes by default), and scheduled Jobs use the same value as their hard
Kubernetes deadline.

## Garmin

Garmin Connect runs in the Divetracx server process. No extra deployment,
service, Secret, or token volume is needed. The client is server-only, so
Garmin credentials never reach the browser.

```yaml
garmin:
  sync:
    enabled: true # daily incremental Garmin import CronJob
```

After the first deployment, connect the Garmin account once from the Divetracx
UI under Settings → Integrations. The application stores only the resulting
OAuth tokens in PostgreSQL and refreshes them automatically. If Garmin requests
multi-factor authentication, the UI asks for the verification code and resumes
the same short-lived login challenge; passwords and verification codes are not
persisted. Upgrades from the former adapter deployment require one reconnect;
its old token volume is intentionally not reused. Garmin export is not supported.

## Install with external PostgreSQL

Prefer a Secret containing the complete database URL:

```bash
helm install divetracx ./charts \
  --set hodor.password='change-me' \
  --set postgresql.existingSecret='divetracx-database' \
  --set postgresql.existingSecretKey='url' \
  --set divemate.existingSecret='divetracx-divemate' \
  --set sync.enabled=true
```

For a simple test installation, `postgresql.external.url` can be supplied
directly, but it is then stored in Helm release state.

## Install with bundled PostgreSQL

```bash
helm install divetracx ./charts \
  --set hodor.password='change-me' \
  --set postgresql.enabled=true \
  --set postgresql.auth.password='database-password' \
  --set divemate.existingSecret='divetracx-divemate' \
  --set sync.enabled=true
```

Bundled PostgreSQL is intended for simple self-hosted installations. Prefer a
managed database when backups and high availability matter.

PostgreSQL major versions cannot reuse an older server's data files directly.
Before upgrading a release with bundled PostgreSQL to version 18, back up the
database and restore it into a fresh PostgreSQL 18 PVC (or use `pg_upgrade`).

## OAuth-protected MCP

The optional MCP endpoint includes an instance-wide OAuth 2.1 authorization
server. It uses the existing Hodor owner session for consent, dynamic client
registration, mandatory S256 PKCE, refresh rotation, and revocation. No external
OIDC provider settings are required. After deployment, the owner configures
individual read, write, and delete tools, connected clients, and revocation in
**Settings → AI access**.

Enabling MCP adds its protocol endpoint, OAuth discovery documents, and token
endpoints to Hodor's `BYPASS_PATHS`, so machine clients reach them without a
login form while everything else stays gated. The MCP endpoint independently
requires OAuth on every protocol request. `/oauth/authorize` is deliberately not
public: it asks the owner to approve a client, so Hodor authenticates it first.

```yaml
mcp:
  enabled: true
  allowedOrigins:
    - https://chatgpt.com
```

The MCP host must also be the normal Hodor-protected application host so the
owner session can approve connections. Do not expose the dedicated MCP Service
with unrestricted paths through an additional proxy. For browser-based MCP
clients, `mcp.allowedOrigins` adds an explicit Origin allowlist; native clients
normally omit the Origin header.

Divetracx derives `https://<host>/api/mcp` from the incoming application URL.
There is no separate MCP URL setting and the MCP Service is only a path-limited
route to the same Divetracx application process.

## Validate

```bash
helm lint charts \
  --set hodor.enabled=false \
  --set postgresql.external.url='postgresql://user:pass@postgres:5432/divetracx' \
  --set divemate.existingSecret='divetracx-divemate' \
  --set divemate.googleDriveFolderId='example-folder-id' \
  --set sync.enabled=true
```
