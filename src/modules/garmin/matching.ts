/**
 * Matches a Garmin activity to an existing canonical log entry by comparing
 * dive start instants. A Garmin dive attaches to the nearest existing dive
 * within the tolerance instead of creating a duplicate log entry.
 */

export const GARMIN_DIVE_MATCH_TOLERANCE_SECONDS = 45 * 60

export interface DiveStartCandidate {
  id: string
  diveDate: string
  entryTime: string | null
  utcOffsetMinutes: number | null
}

export interface DiveMatch {
  diveId: string
  differenceSeconds: number
}

/**
 * Converts a dive's local date/time to UTC epoch seconds. Dives without an
 * entry time cannot be matched. When the dive has no stored UTC offset, the
 * Garmin activity's offset is assumed (same location, same timezone).
 */
export function diveStartEpochSeconds(
  candidate: Pick<DiveStartCandidate, 'diveDate' | 'entryTime' | 'utcOffsetMinutes'>,
  fallbackUtcOffsetMinutes: number | null,
): number | null {
  if (!candidate.entryTime) return null
  const localEpochMilliseconds = Date.parse(
    `${candidate.diveDate}T${candidate.entryTime}Z`,
  )
  if (Number.isNaN(localEpochMilliseconds)) return null
  const offsetMinutes = candidate.utcOffsetMinutes ?? fallbackUtcOffsetMinutes ?? 0
  return localEpochMilliseconds / 1_000 - offsetMinutes * 60
}

export function selectNearestDive(
  candidates: DiveStartCandidate[],
  targetEpochSeconds: number,
  fallbackUtcOffsetMinutes: number | null,
  toleranceSeconds: number = GARMIN_DIVE_MATCH_TOLERANCE_SECONDS,
): DiveMatch | null {
  let nearest: DiveMatch | null = null
  for (const candidate of candidates) {
    const startEpochSeconds = diveStartEpochSeconds(candidate, fallbackUtcOffsetMinutes)
    if (startEpochSeconds === null) continue
    const differenceSeconds = Math.abs(startEpochSeconds - targetEpochSeconds)
    if (differenceSeconds > toleranceSeconds) continue
    if (nearest === null || differenceSeconds < nearest.differenceSeconds) {
      nearest = { diveId: candidate.id, differenceSeconds }
    }
  }
  return nearest
}

/** The three calendar dates a nearby dive could be logged under. */
export function adjacentDiveDates(diveDate: string): string[] {
  const parsed = Date.parse(`${diveDate}T00:00:00Z`)
  if (Number.isNaN(parsed)) return [diveDate]
  const dayMilliseconds = 24 * 60 * 60 * 1_000
  return [parsed - dayMilliseconds, parsed, parsed + dayMilliseconds].map((timestamp) =>
    new Date(timestamp).toISOString().slice(0, 10),
  )
}
