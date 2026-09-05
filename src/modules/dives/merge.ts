import { formatDiveDate } from './format'

/**
 * Recombining a dive a computer split into several log entries. The rules here
 * are pure so they can be exercised without a database; `merge.server.ts` moves
 * the rows.
 */

export interface MergeDiveInput {
  id: string
  number: number | null
  diveDate: string
  entryTime: string | null
  utcOffsetMinutes: number | null
  durationSeconds: number
  surfaceIntervalSeconds: number | null
  maximumDepthMeters: string | null
  averageDepthMeters: string | null
  airTemperatureCelsius: string | null
  waterTemperatureCelsius: string | null
  weightKg: string | null
  equipmentWeightKg: string | null
  maximumPpo2: string | null
  decompressionDive: boolean
  visibility: string | null
  current: string | null
  waves: string | null
  weather: string | null
  waterType: number | null
  entryType: number | null
  rating: number | null
  computer: string | null
  suit: string | null
  notes: string | null
  siteId: string | null
  siteName: string | null
  shopId: string | null
  boatId: string | null
  diveTypeId: string | null
  diverId: string | null
}

export interface MergeSample {
  elapsedSeconds: number
  depthMeters: string
}

export interface MergeSegment {
  dive: MergeDiveInput
  segmentIndex: number
  /** Seconds from the merged dive's start to this segment's start. */
  offsetSeconds: number
  /** Surface seconds between the previous segment's last sample and this one. */
  gapSeconds: number
  label: string
}

export interface MergePlan {
  /** The dive that survives: the earliest, which the rest are appended to. */
  keeperId: string
  segments: MergeSegment[]
  fields: MergeFields
  /** Total merged length, first segment's entry to the last segment's exit. */
  durationSeconds: number
}

export interface MergeFields {
  diveDate: string
  entryTime: string | null
  utcOffsetMinutes: number | null
  durationSeconds: number
  surfaceIntervalSeconds: number | null
  maximumDepthMeters: string | null
  averageDepthMeters: string | null
  airTemperatureCelsius: string | null
  waterTemperatureCelsius: string | null
  weightKg: string | null
  equipmentWeightKg: string | null
  maximumPpo2: string | null
  decompressionDive: boolean
  visibility: string | null
  current: string | null
  waves: string | null
  weather: string | null
  waterType: number | null
  entryType: number | null
  rating: number | null
  computer: string | null
  suit: string | null
  notes: string | null
  siteId: string | null
  shopId: string | null
  boatId: string | null
  diveTypeId: string | null
  diverId: string | null
}

export class DiveMergeError extends Error {}

export function describeDive(dive: MergeDiveInput) {
  const number = dive.number === null ? 'Unnumbered dive' : `Dive #${dive.number}`
  const clock = dive.entryTime ? ` ${dive.entryTime.slice(0, 5)}` : ''
  const site = dive.siteName ? ` · ${dive.siteName}` : ''
  return `${number} · ${formatDiveDate(dive.diveDate, 'medium')}${clock}${site}`
}

/**
 * Absolute start of a dive in seconds, normalised to UTC when the dive records
 * an offset. Returns null when the dive has no entry time, which leaves it to
 * be chained onto the previous segment instead.
 */
function startSeconds(dive: MergeDiveInput) {
  if (!dive.entryTime) return null
  const [hours = 0, minutes = 0, seconds = 0] = dive.entryTime
    .split(':')
    .map((part) => Number(part))
  const day = Date.parse(`${dive.diveDate}T00:00:00Z`)
  if (!Number.isFinite(day)) return null
  const local = day / 1000 + hours * 3600 + minutes * 60 + seconds
  return local - (dive.utcOffsetMinutes ?? 0) * 60
}

/**
 * Length of a dive's recorded profile. The stored duration can disagree with
 * the samples — a computer that cut out mid-dive keeps the planned duration —
 * and the samples are what gets appended, so the longer of the two wins.
 */
function segmentSeconds(dive: MergeDiveInput, samples: MergeSample[]) {
  const lastSample = samples.at(-1)?.elapsedSeconds ?? 0
  return Math.max(dive.durationSeconds, lastSample)
}

function firstNonNull<T>(values: Array<T | null>): T | null {
  for (const value of values) if (value !== null) return value
  return null
}

function numericMaximum(values: Array<string | null>) {
  return values
    .filter((value): value is string => value !== null)
    .reduce<string | null>(
      (best, value) => (best === null || Number(value) > Number(best) ? value : best),
      null,
    )
}

function numericMinimum(values: Array<string | null>) {
  return values
    .filter((value): value is string => value !== null)
    .reduce<string | null>(
      (best, value) => (best === null || Number(value) < Number(best) ? value : best),
      null,
    )
}

/**
 * Time-weighted mean depth over one run of samples — trapezoidal, so uneven
 * sampling is not over-weighted. Returns the covered span alongside it so
 * several runs can be combined without counting the surface gaps between them:
 * the diver was not in the water for those.
 */
function depthIntegral(samples: MergeSample[]) {
  let area = 0
  let span = 0
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    if (!previous || !current) continue
    const step = current.elapsedSeconds - previous.elapsedSeconds
    if (step <= 0) continue
    area += ((Number(previous.depthMeters) + Number(current.depthMeters)) / 2) * step
    span += step
  }
  return { area, span }
}

/**
 * What a recorded profile says about a dive. A merged dive's scalars are
 * derived from its samples, so this is also how they are restored after an
 * import rewrites the surviving dive from one segment's worth of data.
 */
export function summariseProfile(samples: Array<MergeSample & { segmentIndex: number }>) {
  if (samples.length === 0) return null
  const bySegment = new Map<number, MergeSample[]>()
  for (const sample of samples) {
    const run = bySegment.get(sample.segmentIndex) ?? []
    run.push(sample)
    bySegment.set(sample.segmentIndex, run)
  }
  let area = 0
  let span = 0
  for (const run of bySegment.values()) {
    const integral = depthIntegral(run)
    area += integral.area
    span += integral.span
  }
  return {
    // Entry of the first segment to exit of the last, surface intervals
    // included: that is how long the dive took.
    durationSeconds: Math.max(...samples.map((sample) => sample.elapsedSeconds)),
    maximumDepthMeters: Math.max(
      ...samples.map((sample) => Number(sample.depthMeters)),
    ).toFixed(2),
    averageDepthMeters: span > 0 ? (area / span).toFixed(2) : null,
  }
}

/**
 * Mean depth across the dives going into a merge, falling back to a
 * duration-weighted mean of what each recorded when there are no samples.
 */
function mergeAverageDepth(
  segments: Array<{ dive: MergeDiveInput; samples: MergeSample[] }>,
) {
  let area = 0
  let span = 0
  for (const segment of segments) {
    const integral = depthIntegral(segment.samples)
    area += integral.area
    span += integral.span
  }
  if (span > 0) return (area / span).toFixed(2)

  let weighted = 0
  let weight = 0
  for (const { dive } of segments) {
    if (dive.averageDepthMeters === null || dive.durationSeconds <= 0) continue
    weighted += Number(dive.averageDepthMeters) * dive.durationSeconds
    weight += dive.durationSeconds
  }
  return weight > 0 ? (weighted / weight).toFixed(2) : null
}

function mergeNotes(segments: MergeSegment[]) {
  const parts = segments.flatMap((segment) => {
    const notes = segment.dive.notes?.trim()
    if (!notes) return []
    return segment.segmentIndex === 0 ? [notes] : [`— ${segment.label} —\n${notes}`]
  })
  return parts.length > 0 ? parts.join('\n\n') : null
}

/**
 * Order the dives onto one timeline and work out the merged field values.
 *
 * The earliest dive is the one that survives — it is where the dive actually
 * began, so it keeps its id and its dive number, and the later entries are
 * appended to it.
 */
export function planDiveMerge(
  entries: Array<{ dive: MergeDiveInput; samples: MergeSample[] }>,
): MergePlan {
  const byId = new Set<string>()
  for (const entry of entries) {
    if (byId.has(entry.dive.id)) {
      throw new DiveMergeError('A dive cannot be merged into itself')
    }
    byId.add(entry.dive.id)
  }

  // Dives with a clock go in chronological order; a dive without one keeps the
  // order it was given and is chained onto the previous segment.
  const ordered = entries
    .map((entry, index) => ({ entry, index, start: startSeconds(entry.dive) }))
    .sort((left, right) => {
      if (left.start !== null && right.start !== null) return left.start - right.start
      if (left.start !== null) return -1
      if (right.start !== null) return 1
      return left.index - right.index
    })
    .map(({ entry }) => entry)

  const first = ordered[0]
  if (!first) throw new DiveMergeError('A merge needs at least one dive')
  const origin = startSeconds(first.dive)

  const segments: MergeSegment[] = []
  let previousEnd = 0
  for (const [segmentIndex, entry] of ordered.entries()) {
    const start = startSeconds(entry.dive)
    const offsetSeconds =
      segmentIndex === 0
        ? 0
        : origin !== null && start !== null
          ? start - origin
          : previousEnd + (entry.dive.surfaceIntervalSeconds ?? 0)
    const gapSeconds = offsetSeconds - previousEnd

    if (segmentIndex > 0 && gapSeconds < 0) {
      const previous = segments.at(-1)
      throw new DiveMergeError(
        `${describeDive(entry.dive)} overlaps ${describeDive(previous?.dive ?? first.dive)}. ` +
          'Overlapping dives are duplicates rather than one split dive, so their ' +
          'profiles cannot be appended.',
      )
    }

    segments.push({
      dive: entry.dive,
      segmentIndex,
      offsetSeconds,
      gapSeconds: segmentIndex === 0 ? 0 : gapSeconds,
      label: describeDive(entry.dive),
    })
    previousEnd = offsetSeconds + segmentSeconds(entry.dive, entry.samples)
  }

  const dives = ordered.map((entry) => entry.dive)
  // The surviving dive's value wins; a gap falls back to the next entry along
  // the timeline that recorded one.
  const preferred = <T>(select: (dive: MergeDiveInput) => T | null) =>
    firstNonNull(dives.map(select))

  const earliest = first.dive
  const fields: MergeFields = {
    diveDate: earliest.diveDate,
    entryTime: earliest.entryTime,
    utcOffsetMinutes: earliest.utcOffsetMinutes,
    durationSeconds: previousEnd,
    surfaceIntervalSeconds: earliest.surfaceIntervalSeconds,
    maximumDepthMeters: numericMaximum(dives.map((dive) => dive.maximumDepthMeters)),
    averageDepthMeters: mergeAverageDepth(ordered),
    maximumPpo2: numericMaximum(dives.map((dive) => dive.maximumPpo2)),
    waterTemperatureCelsius: numericMinimum(
      dives.map((dive) => dive.waterTemperatureCelsius),
    ),
    decompressionDive: dives.some((dive) => dive.decompressionDive),
    airTemperatureCelsius: preferred((dive) => dive.airTemperatureCelsius),
    weightKg: preferred((dive) => dive.weightKg),
    equipmentWeightKg: preferred((dive) => dive.equipmentWeightKg),
    visibility: preferred((dive) => dive.visibility),
    current: preferred((dive) => dive.current),
    waves: preferred((dive) => dive.waves),
    weather: preferred((dive) => dive.weather),
    waterType: preferred((dive) => dive.waterType),
    entryType: preferred((dive) => dive.entryType),
    rating: preferred((dive) => (dive.rating === 0 ? null : dive.rating)),
    computer: preferred((dive) => dive.computer),
    suit: preferred((dive) => dive.suit),
    siteId: preferred((dive) => dive.siteId),
    shopId: preferred((dive) => dive.shopId),
    boatId: preferred((dive) => dive.boatId),
    diveTypeId: preferred((dive) => dive.diveTypeId),
    diverId: preferred((dive) => dive.diverId),
    notes: mergeNotes(segments),
  }

  return { keeperId: first.dive.id, segments, fields, durationSeconds: previousEnd }
}

export interface MergeTank {
  id: string
  name: string | null
  sortOrder: number | null
  computerTankNumber: number | null
  volumeLiters: string | null
  startPressureBar: string | null
  endPressureBar: string | null
  workingPressureBar: string | null
  oxygenPercent: string | null
  heliumPercent: string | null
  breathingTimeSeconds: number | null
  weightKg: string | null
}

export interface TankCombination {
  /** Target tank to extend with the source tank's end of the dive. */
  targetTankId: string
  sourceTankId: string
  endPressureBar: string | null
  breathingTimeSeconds: number | null
}

export interface TankAppend {
  sourceTankId: string
  sortOrder: number
  computerTankNumber: number | null
  /** True when the tank has no free tank 1/tank 2 column for its pressures. */
  beyondChartSlots: boolean
}

export interface TankMergeResult {
  combined: TankCombination[]
  appended: TankAppend[]
}

function sameText(left: string | null, right: string | null) {
  const a = (left ?? '').trim().toLocaleLowerCase('en-US')
  const b = (right ?? '').trim().toLocaleLowerCase('en-US')
  // An unnamed tank does not contradict a named one.
  return a === '' || b === '' || a === b
}

function sameNumber(left: string | null, right: string | null) {
  if (left === null || right === null) return true
  return Number(left).toFixed(1) === Number(right).toFixed(1)
}

/**
 * Whether two tank rows describe the same cylinder. Only the fields both rows
 * actually recorded are compared, so a source that omits the volume does not
 * count as a different tank — but a contradicting gas or name does.
 */
function sameTank(left: MergeTank, right: MergeTank) {
  return (
    sameText(left.name, right.name) &&
    sameNumber(left.oxygenPercent, right.oxygenPercent) &&
    sameNumber(left.heliumPercent, right.heliumPercent) &&
    sameNumber(left.volumeLiters, right.volumeLiters)
  )
}

/**
 * A dive split by a computer is normally still breathing the same cylinders, so
 * a source tank that matches one already on the merged dive continues it rather
 * than being added again. The gas has to agree first — a computer reconfigured
 * onto a different mix is a genuinely different cylinder even under the same
 * tank number — and the computer's tank number then picks between equal
 * candidates, since that is what ties samples to a pressure series.
 */
export function mergeTanks(
  targetTanks: MergeTank[],
  sourceTanks: MergeTank[],
): TankMergeResult {
  const combined: TankCombination[] = []
  const appended: TankAppend[] = []
  const claimed = new Set<string>()

  let nextSortOrder = targetTanks.reduce(
    (highest, tank) => Math.max(highest, (tank.sortOrder ?? 0) + 1),
    targetTanks.length,
  )
  const usedNumbers = new Set(
    targetTanks.flatMap((tank) =>
      tank.computerTankNumber === null ? [] : [tank.computerTankNumber],
    ),
  )

  for (const tank of sourceTanks) {
    const candidates = targetTanks.filter(
      (candidate) => !claimed.has(candidate.id) && sameTank(candidate, tank),
    )
    const match =
      candidates.find(
        (candidate) =>
          tank.computerTankNumber !== null &&
          candidate.computerTankNumber === tank.computerTankNumber,
      ) ?? candidates[0]
    if (match) {
      claimed.add(match.id)
      combined.push({
        targetTankId: match.id,
        sourceTankId: tank.id,
        // The merged tank starts where the target started and ends where the
        // source ended; a source with no reading leaves the target's alone.
        endPressureBar: tank.endPressureBar ?? match.endPressureBar,
        breathingTimeSeconds:
          tank.breathingTimeSeconds === null && match.breathingTimeSeconds === null
            ? null
            : (match.breathingTimeSeconds ?? 0) + (tank.breathingTimeSeconds ?? 0),
      })
      continue
    }

    let computerTankNumber = tank.computerTankNumber
    if (computerTankNumber === null || usedNumbers.has(computerTankNumber)) {
      computerTankNumber = 1
      while (usedNumbers.has(computerTankNumber)) computerTankNumber += 1
    }
    usedNumbers.add(computerTankNumber)
    appended.push({
      sourceTankId: tank.id,
      sortOrder: nextSortOrder,
      computerTankNumber,
      // Samples carry only tank 1 and tank 2 pressures, so anything past the
      // second slot keeps its readings but gets no pressure series.
      beyondChartSlots: computerTankNumber > 2,
    })
    nextSortOrder += 1
  }

  return { combined, appended }
}
