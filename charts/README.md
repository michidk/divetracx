# Divetracx Helm chart

This chart deploys Divetracx, an optional Hodor authentication sidecar, database
migrations, and either external or bundled PostgreSQL. It can also create a
daily CronJob that imports the configured DiveMate backup.

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
access is sufficient for imports; Editor access is required for the explicit
manual **Push edits to Drive** action.

The CronJob uses `concurrencyPolicy: Forbid` by default and records its runs as
`schedule`. The application receives the same Secret, so **Sync now** uses the
same importer and records runs as `manual`.

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

## Validate

```bash
helm lint charts \
  --set hodor.enabled=false \
  --set postgresql.external.url='postgresql://user:pass@postgres:5432/divetracx' \
  --set divemate.existingSecret='divetracx-divemate' \
  --set divemate.googleDriveFolderId='example-folder-id' \
  --set sync.enabled=true
```
