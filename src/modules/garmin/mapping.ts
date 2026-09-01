import { isGarminDiveActivity, parseGarminActivityDetails } from './activity-details'
import { type DecodedGarminFit, decodeGarminFit } from './fit'
import type { GarminMappedDive, GarminSourceActivity } from './types'

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isoLocalParts(epochSeconds: number, offsetSeconds: number) {
  const local = new Date((epochSeconds + offsetSeconds) * 1_000)
  return {
    date: local.toISOString().slice(0, 10),
    time: local.toISOString().slice(11, 19),
  }
}

function semicirclesToDegrees(value: unknown): number | null {
  const numeric = finite(value)
  return numeric === null ? null : (numeric * 180) / 2 ** 31
}

function maximum(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null)
  return present.length > 0 ? Math.max(...present) : null
}

function minimum(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null)
  return present.length > 0 ? Math.min(...present) : null
}

export function mapGarminActivity(source: GarminSourceActivity): GarminMappedDive | null {
  const details = parseGarminActivityDetails(source.activityDetails)
  const fit: DecodedGarminFit | null = source.fitBytes
    ? decodeGarminFit(source.fitBytes)
    : null
  if (!fit?.isDive && !isGarminDiveActivity(details)) return null

  const summary = details.summary
  const fitStartedAt = fit?.session?.startTime
  const startSeconds =
    summary.startTimeInSeconds ??
    (fitStartedAt instanceof Date ? fitStartedAt.getTime() / 1_000 : null)
  if (startSeconds === null) {
    throw new Error(`Garmin dive ${details.activityId} is missing a start time`)
  }
  const offsetSeconds = summary.startTimeOffsetInSeconds ?? 0
  const local = isoLocalParts(startSeconds, offsetSeconds)
  const profileDepths = fit?.profileSamples.map((item) => item.depthMeters) ?? []
  const temperatures = fit?.profileSamples.map((item) => item.temperatureCelsius) ?? []
  const maximumDepthMeters = maximum([
    summary.maximumDepthInMeters,
    finite(fit?.summary?.maxDepth),
    ...profileDepths,
  ])
  const averageDepthMeters =
    summary.averageDepthInMeters ?? finite(fit?.summary?.avgDepth)
  const latitude =
    summary.startingLatitudeInDegree ??
    semicirclesToDegrees(fit?.session?.startPositionLat)
  const longitude =
    summary.startingLongitudeInDegree ??
    semicirclesToDegrees(fit?.session?.startPositionLong)

  return {
    externalId: details.activityId,
    diveDate: local.date,
    entryTime: local.time,
    utcOffsetMinutes:
      summary.startTimeOffsetInSeconds === null
        ? null
        : Math.round(summary.startTimeOffsetInSeconds / 60),
    durationSeconds: Math.max(
      0,
      Math.round(summary.durationInSeconds ?? finite(fit?.session?.totalTimerTime) ?? 0),
    ),
    surfaceIntervalSeconds:
      finite(fit?.summary?.surfaceInterval) === null
        ? null
        : Math.round(finite(fit?.summary?.surfaceInterval) ?? 0),
    maximumDepthMeters,
    averageDepthMeters,
    waterTemperatureCelsius: minimum(temperatures),
    maximumPpo2: fit?.maximumPpo2 ?? null,
    number:
      finite(fit?.summary?.diveNumber) === null
        ? null
        : Math.round(finite(fit?.summary?.diveNumber) ?? 0),
    computer: summary.deviceName,
    notes: details.summary.activityName,
    activityName: details.summary.activityName,
    latitude,
    longitude,
    profileSamples: fit?.profileSamples ?? [],
    gases: fit?.gases ?? [],
    fitProfileVersion: fit?.profileVersion ?? null,
  }
}
