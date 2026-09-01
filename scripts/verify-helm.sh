#!/usr/bin/env bash

set -euo pipefail

run_helm() {
  if command -v helm >/dev/null 2>&1; then
    helm "$@"
    return
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Helm is unavailable and Docker is not running." >&2
    exit 1
  fi

  docker run --rm \
    --volume "$PWD:/work" \
    --workdir /work \
    alpine/helm:3.18.4 "$@"
}

external_values=(
  --set hodor.enabled=false
  --set postgresql.external.url=postgresql://user:pass@postgres:5432/divetracx
  --set divemate.existingSecret=divetracx-divemate
  --set divemate.googleDriveFolderId=example-folder-id
  --set sync.enabled=true
  --set garmin.fullImportUrl=https://garmin-adapter.example.test/import
  --set garmin.incrementalImportUrl=https://garmin-adapter.example.test/import
  --set garmin.existingSecret=divetracx-garmin
  --set garmin.sync.enabled=true
)

bundled_values=(
  --set hodor.password=test-password
  --set postgresql.enabled=true
  --set postgresql.auth.password=database-password
  --set divemate.existingSecret=divetracx-divemate
  --set divemate.googleDriveFolderId=example-folder-id
  --set sync.enabled=true
  --set garminAdapter.enabled=true
  --set garmin.existingSecret=divetracx-garmin
  --set garmin.sync.enabled=true
)

run_helm lint charts "${external_values[@]}"
run_helm template divetracx charts "${external_values[@]}" >/dev/null
run_helm lint charts "${bundled_values[@]}"
run_helm template divetracx charts "${bundled_values[@]}" >/dev/null
