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

{{/*
Paths Hodor serves without a password. MCP's discovery, registration, token, and
protocol endpoints are reached by machines that cannot complete a login form.
`/oauth/authorize` is deliberately absent: it asks the owner to approve a client,
so it has to stay behind the gate.
*/}}
{{- define "divetracx.hodorBypassPaths" -}}
{{- $paths := .Values.hodor.bypassPaths | default list -}}
{{- if .Values.mcp.enabled -}}
{{- $paths = concat $paths (list
  "/api/mcp"
  "/.well-known/oauth-protected-resource/api/mcp"
  "/.well-known/oauth-authorization-server"
  "/oauth/register"
  "/oauth/token"
  "/oauth/revoke") -}}
{{- end -}}
{{- join "," (uniq $paths) -}}
{{- end -}}

{{/*
Whether Hodor forwards the original Host header. MCP validates the raw Host on
its protocol and OAuth endpoints, so replacing it with the upstream authority
makes every MCP request fail with "Invalid Host".
*/}}
{{- define "divetracx.hodorPreserveHost" -}}
{{- or .Values.hodor.preserveHost .Values.mcp.enabled | ternary "true" "false" -}}
{{- end -}}
