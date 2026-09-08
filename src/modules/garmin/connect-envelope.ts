/**
 * Pure mapping between raw Garmin Connect activity list JSON and the
 * transaction-ready Garmin batch consumed by the main application server.
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

export interface GarminConnectState {
  lastActivityStartSeconds: number | null
}

export interface GarminConnectActivity {
  activityDetails: Record<string, unknown>
  /** Absent for dives logged by hand in the Garmin Dive app. */
  fitBytes?: Uint8Array
  fitFileName?: string
  fitContentType?: string
}

/**
 * One item from the Garmin Dive app's gear list. Garmin files certifications
 * under gear too (`type: 'CERTIFICATION'`), carrying only a name and date.
 */
export interface GarminConnectGear {
  gearId: string
  type: string
  detail: Record<string, unknown>
}

export interface GarminConnectBatch {
  activities: GarminConnectActivity[]
  /** Absent when the gear entities are switched off or the Dive API failed. */
  gear?: GarminConnectGear[]
  nextState: Record<string, unknown>
  sourceDescription: string
  complete: boolean
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

/**
 * Normalizes one entry of the Garmin Dive app's dive list into the Activity
 * Details shape `parseGarminActivityDetails` understands. The Dive service
 * knows the dive's own name, number, and tags, which Connect's activity list
 * does not; depths are still left to the FIT file.
 */
export function buildDiveActivityDetails(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  // A dive logged by hand in the app has no Connect activity; its own Dive
  // id is prefixed so it can never collide with an activity id.
  const activityId =
    stringValue(raw.connectActivityId) ??
    (stringValue(raw.id) ? `dive-${stringValue(raw.id)}` : null)
  if (!activityId) {
    throw new Error('Garmin Dive summary entry is missing an id')
  }
  const startTimeInSeconds = (() => {
    const text = stringValue(raw.startTime)
    if (!text) return null
    const parsed = Date.parse(text)
    return Number.isNaN(parsed) ? null : Math.round(parsed / 1_000)
  })()
  const totalTime = numberValue(raw.totalTime)
  return {
    ...raw,
    activityId,
    activityType: connectActivityTypeForDiveType(stringValue(raw.diveType)),
    activityName: stringValue(raw.name),
    startTimeInSeconds,
    startTimeOffsetInSeconds: utcOffsetSecondsFromIso(stringValue(raw.startTime)),
    durationInSeconds: totalTime === null ? null : Math.round(totalTime),
    startingLatitudeInDegree: numberValue(record(raw.entryLoc)?.latitude),
    startingLongitudeInDegree: numberValue(record(raw.entryLoc)?.longitude),
  }
}

/** The Dive service names dive types differently from Connect's activity type keys. */
const CONNECT_TYPE_BY_DIVE_TYPE: Record<string, string> = {
  SINGLE_GAS: 'single_gas_diving',
  MULTI_GAS: 'multi_gas_diving',
  GAUGE: 'gauge_diving',
  APNEA: 'apnea_diving',
  APNEA_HUNT: 'apnea_hunting',
  APNEA_HUNTING: 'apnea_hunting',
  CCR: 'ccr_diving',
  DYNAMIC_APNEA: 'dynamic_apnea',
}

function connectActivityTypeForDiveType(diveType: string | null) {
  if (!diveType) return 'diving'
  return CONNECT_TYPE_BY_DIVE_TYPE[diveType.toUpperCase()] ?? 'diving'
}

/** `2025-06-15T10:00:00+02:00` → 7200; `Z` or no designator → 0 / null. */
function utcOffsetSecondsFromIso(value: string | null): number | null {
  if (!value) return null
  const match = /(Z|[+-]\d{2}:?\d{2})$/.exec(value)
  if (!match?.[1]) return null
  if (match[1] === 'Z') return 0
  const sign = match[1].startsWith('-') ? -1 : 1
  const digits = match[1].slice(1).replace(':', '')
  return sign * (Number(digits.slice(0, 2)) * 3_600 + Number(digits.slice(2)) * 60)
}

export function parseAdapterState(state: Record<string, unknown>): GarminConnectState {
  const value = numberValue(state.lastActivityStartSeconds)
  return { lastActivityStartSeconds: value }
}

export function nextAdapterState(
  previous: GarminConnectState,
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
  watermark: GarminConnectState,
  overlapSeconds: number,
): boolean {
  if (startEpochSeconds === null) return true
  if (watermark.lastActivityStartSeconds === null) return true
  return startEpochSeconds > watermark.lastActivityStartSeconds - overlapSeconds
}
