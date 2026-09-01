/**
 * Pure mapping between raw Garmin Connect activity list JSON and the Divetracx
 * Garmin adapter envelope documented in docs/import-export-architecture.md.
 */

export const GARMIN_DIVE_ACTIVITY_TYPE_KEYS = new Set([
  'diving',
  'single_gas_diving',
  'multi_gas_diving',
  'gauge_diving',
  'apnea_diving',
  'apnea_hunting',
  'ccr_diving',
  'dynamic_apnea',
])

export interface GarminAdapterState {
  lastActivityStartSeconds: number | null
}

export interface GarminAdapterActivity {
  activityDetails: Record<string, unknown>
  fitBase64: string
  fitFileName: string
  fitContentType: string
}

export interface GarminAdapterBatch {
  activities: GarminAdapterActivity[]
  nextState: Record<string, unknown>
  sourceDescription: string
  diagnostics: Record<string, unknown>
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function activityIdentity(raw: Record<string, unknown>): string | null {
  return stringValue(raw.activityId)
}

export function activityTypeKey(raw: Record<string, unknown>): string | null {
  return stringValue(record(raw.activityType)?.typeKey)
}

export function isDiveActivity(raw: Record<string, unknown>): boolean {
  const typeKey = activityTypeKey(raw)
  return typeKey !== null && GARMIN_DIVE_ACTIVITY_TYPE_KEYS.has(typeKey)
}

/** Parses Garmin Connect's `YYYY-MM-DD HH:mm:ss` timestamps as UTC seconds. */
function connectTimestampSeconds(value: unknown): number | null {
  const text = stringValue(value)
  if (!text) return null
  const parsed = Date.parse(`${text.replace(' ', 'T')}Z`)
  return Number.isNaN(parsed) ? null : parsed / 1_000
}

export function activityStartEpochSeconds(raw: Record<string, unknown>): number | null {
  const beginTimestamp = numberValue(raw.beginTimestamp)
  if (beginTimestamp !== null) return Math.round(beginTimestamp / 1_000)
  return connectTimestampSeconds(raw.startTimeGMT)
}

export function activityUtcOffsetSeconds(raw: Record<string, unknown>): number | null {
  const local = connectTimestampSeconds(raw.startTimeLocal)
  const utc = connectTimestampSeconds(raw.startTimeGMT)
  if (local === null || utc === null) return null
  return Math.round(local - utc)
}

/**
 * Normalizes one raw Garmin Connect activity into the Activity Details shape
 * that `parseGarminActivityDetails` understands, preserving the complete raw
 * payload for provenance. Depth summary values are intentionally not mapped;
 * the FIT file is the authoritative source for depths and samples.
 */
export function buildActivityDetails(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const activityId = activityIdentity(raw)
  if (!activityId) {
    throw new Error('Garmin Connect activity is missing an activityId')
  }
  return {
    ...raw,
    activityId,
    activityType: activityTypeKey(raw),
    activityName: stringValue(raw.activityName),
    startTimeInSeconds: activityStartEpochSeconds(raw),
    startTimeOffsetInSeconds: activityUtcOffsetSeconds(raw),
    durationInSeconds:
      numberValue(raw.duration) === null
        ? null
        : Math.round(numberValue(raw.duration) ?? 0),
    startingLatitudeInDegree: numberValue(raw.startLatitude),
    startingLongitudeInDegree: numberValue(raw.startLongitude),
  }
}

export function parseAdapterState(state: Record<string, unknown>): GarminAdapterState {
  const value = numberValue(state.lastActivityStartSeconds)
  return { lastActivityStartSeconds: value }
}

export function nextAdapterState(
  previous: GarminAdapterState,
  activityStartSeconds: Array<number | null>,
): Record<string, unknown> {
  const observed = activityStartSeconds.filter((value): value is number => value !== null)
  const latest = Math.max(
    previous.lastActivityStartSeconds ?? Number.NEGATIVE_INFINITY,
    ...observed,
  )
  return {
    lastActivityStartSeconds: Number.isFinite(latest) ? latest : null,
  }
}

/**
 * An incremental import only keeps activities newer than the stored watermark,
 * minus a safety overlap; the connector's content hashes make re-observed
 * activities idempotent. Activities without a parsable start time are kept.
 */
export function isAfterWatermark(
  startEpochSeconds: number | null,
  watermark: GarminAdapterState,
  overlapSeconds: number,
): boolean {
  if (startEpochSeconds === null) return true
  if (watermark.lastActivityStartSeconds === null) return true
  return startEpochSeconds > watermark.lastActivityStartSeconds - overlapSeconds
}
