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
  googleDriveFolderId: 1j1_x_2tGZxx9hkmfWBhplErr-6UMamF8
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

## Garmin adapter

Garmin transport goes through a server-side adapter so Garmin credentials never
reach the browser. The chart can deploy the bundled adapter, which signs in to
the Garmin Connect consumer API with tokens persisted on a small volume:

```bash
kubectl create secret generic divetracx-garmin \
  --from-literal=authorization='Bearer replace-with-a-long-random-secret'
```

```yaml
garmin:
  existingSecret: divetracx-garmin
  authorizationSecretKey: authorization
  sync:
    enabled: true # daily incremental Garmin import CronJob
garminAdapter:
  enabled: true
```

After the first deployment, connect the Garmin account once from the Divetracx
UI under Settings → Integrations. The application forwards the credentials
server-to-server to the adapter, which stores only the resulting OAuth tokens
on the persistent volume and refreshes them automatically. If Garmin requests
multi-factor authentication, the UI asks for the verification code and resumes
the same short-lived login challenge; passwords and verification codes are not
persisted.
To use an external adapter instead, leave `garminAdapter.enabled` off and set
`garmin.fullImportUrl`/`garmin.incrementalImportUrl`.

The Secret value is used as the complete `Authorization` header sent to the
adapter and checked by the bundled adapter. The adapter returns Activity
Details, base64 FIT data, and opaque next state. Garmin export is not
supported.

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

## OAuth-protected MCP

The optional MCP endpoint validates JWT access tokens from an external OIDC
provider. Configure that provider with the public MCP URL as the token audience
and grant the `divetracx:read` scope. It must publish discovery metadata and a
JWKS endpoint; clients need authorization code with PKCE and either dynamic
client registration or a pre-registered client.

The MCP Ingress routes only the protocol endpoint and its OAuth discovery
documents directly to the application, bypassing Hodor's interactive cookie
gate. The MCP endpoint independently requires OAuth on every protocol request.

```yaml
mcp:
  enabled: true
  serverUrl: https://dives.example.com/api/mcp
  oauth:
    issuer: https://auth.example.com/application/o/divetracx/
    audience: https://dives.example.com/api/mcp # optional; defaults to serverUrl
    scope: divetracx:read
  ingress:
    enabled: true
    className: nginx
    hosts:
      - host: dives.example.com
    tls:
      - secretName: dives-tls
        hosts:
          - dives.example.com
```

Do not expose the dedicated MCP Service with unrestricted paths through an
additional proxy. For browser-based MCP clients, `mcp.allowedOrigins` can add
an explicit Origin allowlist; native clients normally omit the Origin header.

## Validate

```bash
helm lint charts \
  --set hodor.enabled=false \
  --set postgresql.external.url='postgresql://user:pass@postgres:5432/divetracx' \
  --set divemate.existingSecret='divetracx-divemate' \
  --set divemate.googleDriveFolderId='example-folder-id' \
  --set sync.enabled=true
```
