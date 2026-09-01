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
same importer and records runs as `manual`.

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

After the first deployment, log the adapter in to Garmin Connect once through
its browser setup page (the tokens land on the persistent volume and are
refreshed automatically):

```bash
kubectl port-forward svc/divetracx-garmin-adapter 8787:8787
# then open http://localhost:8787 and log in
```

To password-protect the setup page, add a `ui-password` key to the same Secret
(the key name is configurable via `garminAdapter.uiPasswordSecretKey`); the
page then requires it as HTTP Basic auth password. Accounts with multi-factor
authentication are not supported by this login flow.
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

## Validate

```bash
helm lint charts \
  --set hodor.enabled=false \
  --set postgresql.external.url='postgresql://user:pass@postgres:5432/divetracx' \
  --set divemate.existingSecret='divetracx-divemate' \
  --set divemate.googleDriveFolderId='example-folder-id' \
  --set sync.enabled=true
```
