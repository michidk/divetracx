# Divetracx Helm chart

This chart deploys Divetracx, an optional Hodor authentication sidecar, database
migrations, and either external or bundled PostgreSQL. It can also create a
daily CronJob that imports the configured DiveMate backup.

## DiveMate backup Secret

The recommended setup keeps the backup URL out of Helm values:

```bash
kubectl create secret generic divetracx-divemate \
  --from-literal=backup-url='https://example.com/private/DiveMate.ddb'
```

Then enable the daily sync:

```yaml
divemate:
  existingSecret: divetracx-divemate
  existingSecretKey: backup-url

sync:
  enabled: true
  schedule: "0 3 * * *"
  timeZone: Etc/UTC
```

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

For a simple test installation, `postgresql.external.url` and
`divemate.backupUrl` can be supplied directly, but both values are then stored
in Helm release state.

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
  --set divemate.backupUrl='https://example.com/DiveMate.ddb' \
  --set sync.enabled=true
```
