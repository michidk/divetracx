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

## Private MCP

MCP uses stateless Streamable HTTP without OAuth. Enable it only on a private
network. The chart creates a dedicated ClusterIP Service on port 80, forwarding
to the application on port 3000. Public MCP requests remain behind Hodor.

```yaml
mcp:
  enabled: true
  allowedNamespaces:
    - vibepod
  allowedHosts: []
  allowedOrigins: []
```

The Service hostname and localhost are allowed automatically. Add additional
private hostnames through `allowedHosts`. Browser clients also require an
explicit Origin allowlist. Keep `networkPolicy.enabled` and Hodor enabled when
using public ingress. For ChatGPT, connect the outbound tunnel to
`http://divetracx-mcp.divetracx.svc.cluster.local/api/mcp` and choose
No authentication. Each connected client can use every tool enabled under
Settings > AI access. That page also pauses access and lists tool activity.

## Validate

```bash
helm lint charts \
  --set hodor.enabled=false \
  --set postgresql.external.url='postgresql://user:pass@postgres:5432/divetracx' \
  --set divemate.existingSecret='divetracx-divemate' \
  --set divemate.googleDriveFolderId='example-folder-id' \
  --set sync.enabled=true
```
