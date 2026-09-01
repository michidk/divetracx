import type { GarminActivityDetails, GarminActivitySummary } from './types'

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function first(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return null
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parseSummary(
  source: Record<string, unknown>,
  fallbackActivityId: string,
): GarminActivitySummary {
  return {
    activityId:
      stringValue(first(source, 'ActivityId', 'activityId')) ?? fallbackActivityId,
    activityType: stringValue(first(source, 'ActivityType', 'activityType')),
    activityName: stringValue(first(source, 'ActivityName', 'activityName')),
    deviceName: stringValue(first(source, 'DeviceName', 'deviceName')),
    startTimeInSeconds: numberValue(
      first(source, 'StartTimeInSeconds', 'startTimeInSeconds'),
    ),
    startTimeOffsetInSeconds: numberValue(
      first(source, 'StartTimeOffsetInSeconds', 'startTimeOffsetInSeconds'),
    ),
    durationInSeconds: numberValue(
      first(source, 'DurationInSeconds', 'durationInSeconds'),
    ),
    startingLatitudeInDegree: numberValue(
      first(source, 'StartingLatitudeInDegree', 'startingLatitudeInDegree'),
    ),
    startingLongitudeInDegree: numberValue(
      first(source, 'StartingLongitudeInDegree', 'startingLongitudeInDegree'),
    ),
    maximumDepthInMeters: numberValue(
      first(source, 'MaximumDepthInMeters', 'maximumDepthInMeters'),
    ),
    averageDepthInMeters: numberValue(
      first(source, 'AverageDepthInMeters', 'averageDepthInMeters'),
    ),
  }
}

export function parseGarminActivityDetails(input: unknown): GarminActivityDetails {
  const raw = record(input)
  if (!raw) throw new Error('Garmin Activity Details must be a JSON object')
  const summarySource = record(first(raw, 'Summary', 'summary')) ?? raw
  const activityId =
    stringValue(first(raw, 'ActivityId', 'activityId')) ??
    stringValue(first(summarySource, 'ActivityId', 'activityId'))
  if (!activityId) throw new Error('Garmin Activity Details is missing ActivityId')

  return {
    activityId,
    summaryId: stringValue(first(raw, 'SummaryId', 'summaryId')),
    insertedDate: stringValue(first(raw, 'InsertedDate', 'insertedDate')),
    summary: parseSummary(summarySource, activityId),
    raw,
  }
}

const DIVE_ACTIVITY_TYPES = new Set([
  'diving',
  'single_gas_diving',
  'singlegasdiving',
  'multi_gas_diving',
  'multigasdiving',
  'gauge_diving',
  'gaugediving',
  'apnea_diving',
  'apneadiving',
  'apnea_hunting',
  'apneahunting',
  'ccr_diving',
  'ccrdiving',
  'dynamic_apnea',
  'dynamicapnea',
])

function normalizeActivityType(value: string | null) {
  return value?.replace(/[ -]/g, '_').toLowerCase() ?? ''
}

export function isGarminDiveActivity(details: GarminActivityDetails) {
  return DIVE_ACTIVITY_TYPES.has(normalizeActivityType(details.summary.activityType))
}
