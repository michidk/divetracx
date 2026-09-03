{{- define "divetracx.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "divetracx.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "divetracx.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "divetracx.labels" -}}
helm.sh/chart: {{ include "divetracx.chart" . }}
{{ include "divetracx.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "divetracx.selectorLabels" -}}
app.kubernetes.io/name: {{ include "divetracx.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "divetracx.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "divetracx.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "divetracx.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) -}}
{{- end }}

{{- define "divetracx.postgresqlName" -}}
{{- printf "%s-postgresql" (include "divetracx.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "divetracx.postgresqlSecretName" -}}
{{- include "divetracx.postgresqlName" . -}}
{{- end }}

{{- define "divetracx.dbSecretName" -}}
{{- printf "%s-db" (include "divetracx.fullname" . | trunc 49 | trimSuffix "-") -}}
{{- end }}

{{- define "divetracx.migrationDbSecretName" -}}
{{- printf "%s-migrations-db" (include "divetracx.fullname" . | trunc 49 | trimSuffix "-") -}}
{{- end }}

{{- define "divetracx.divemateSecretName" -}}
{{- if .Values.divemate.existingSecret -}}
{{- .Values.divemate.existingSecret -}}
{{- else -}}
{{- printf "%s-divemate" (include "divetracx.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{- define "divetracx.garminAdapterName" -}}
{{- printf "%s-garmin-adapter" (include "divetracx.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "divetracx.garminAdapterFullImportUrl" -}}
{{- if .Values.garmin.fullImportUrl -}}
{{- .Values.garmin.fullImportUrl -}}
{{- else -}}
{{- printf "http://%s:%d/import" (include "divetracx.garminAdapterName" .) (int .Values.garminAdapter.port) -}}
{{- end -}}
{{- end }}

{{- define "divetracx.garminAdapterIncrementalImportUrl" -}}
{{- if .Values.garmin.incrementalImportUrl -}}
{{- .Values.garmin.incrementalImportUrl -}}
{{- else -}}
{{- printf "http://%s:%d/import" (include "divetracx.garminAdapterName" .) (int .Values.garminAdapter.port) -}}
{{- end -}}
{{- end }}
