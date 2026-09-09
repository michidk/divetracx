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

/**
 * The session's own average/maximum when the watch recorded one, otherwise
 * derived from the samples so a computer that omits the summary still counts.
 */
function heartRateSummary(fit: DecodedGarminFit | null, kind: 'avg' | 'max') {
  const fromSession = finite(
    kind === 'avg' ? fit?.session?.avgHeartRate : fit?.session?.maxHeartRate,
  )
  if (fromSession !== null && fromSession > 0) return Math.round(fromSession)
  const readings = (fit?.profileSamples ?? [])
    .map((sample) => sample.heartRateBpm)
    .filter((value): value is number => value !== null)
  if (readings.length === 0) return null
  return kind === 'max'
    ? Math.max(...readings)
    : Math.round(readings.reduce((sum, value) => sum + value, 0) / readings.length)
}

function roundOrNull(value: number | null) {
  return value === null ? null : Math.round(value)
}

function minimum(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null)
  return present.length > 0 ? Math.min(...present) : null
}

/**
 * The Dive service lists each gas with its planned use; matched onto the FIT
 * gases by oxygen and helium content, in order.
 */
function gasRoles(
  raw: Record<string, unknown>,
): Array<{ o2: number | null; he: number | null; role: string }> {
  const gases = Array.isArray(raw.gases) ? raw.gases : []
  return gases.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const gas = item as Record<string, unknown>
    const status = typeof gas.gasStatus === 'string' ? gas.gasStatus : null
    if (!status) return []
    return [
      {
        o2: finite(gas.percentOxygen),
        he: finite(gas.percentHelium),
        role:
          status === 'BOTTOM_GAS'
            ? 'bottom'
            : status.startsWith('DECO')
              ? 'deco'
              : status.startsWith('TRAVEL')
                ? 'travel'
                : status.toLowerCase(),
      },
    ]
  })
}

function withGasRoles(gases: GarminMappedDive['gases'], raw: Record<string, unknown>) {
  const roles = gasRoles(raw)
  if (roles.length === 0) return gases
  const remaining = [...roles]
  return gases.map((gas) => {
    const index = remaining.findIndex(
      (candidate) =>
        (candidate.o2 === null ||
          gas.oxygenPercent === null ||
          Math.round(candidate.o2) === Math.round(gas.oxygenPercent)) &&
        (candidate.he === null ||
          gas.heliumPercent === null ||
          Math.round(candidate.he) === Math.round(gas.heliumPercent)),
    )
    if (index === -1) return gas
    const [match] = remaining.splice(index, 1)
    return { ...gas, role: match?.role ?? null }
  })
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
    startEpochSeconds: Math.round(startSeconds),
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
    averageHeartRateBpm: heartRateSummary(fit, 'avg'),
    maximumHeartRateBpm: heartRateSummary(fit, 'max'),
    startCnsPercent: roundOrNull(finite(fit?.summary?.startCns)),
    endCnsPercent: roundOrNull(finite(fit?.summary?.endCns)),
    oxygenToxicityUnits: roundOrNull(finite(fit?.summary?.o2Toxicity)),
    deco: fit?.deco ?? null,
    // The Dive service knows whether the dive incurred a deco obligation; the
    // FIT only shows it indirectly through a non-zero ceiling.
    decompressionDive:
      details.raw.isDeco === true ||
      details.raw.deco === true ||
      (fit?.profileSamples ?? []).some(
        (sample) => sample.decoCeilingMeters !== null && sample.decoCeilingMeters > 0,
      ),
    device: fit?.device ?? null,
    events: fit?.events ?? [],
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
    gases: withGasRoles(fit?.gases ?? [], details.raw),
    fitProfileVersion: fit?.profileVersion ?? null,
  }
}
