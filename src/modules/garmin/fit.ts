import type {
  DiveGasMesg,
  DiveSummaryMesg,
  FitMessages,
  RecordMesg,
  SessionMesg,
} from '@garmin/fitsdk'
import { Decoder, Stream } from '@garmin/fitsdk'
import type { GarminGas, GarminProfileSample } from './types'

const DIVING_SUB_SPORTS = new Set([
  'singleGasDiving',
  'multiGasDiving',
  'gaugeDiving',
  'apneaDiving',
  'apneaHunting',
  'ccrDiving',
  'dynamicApnea',
])

export interface DecodedGarminFit {
  isDive: boolean
  session: SessionMesg | null
  summary: DiveSummaryMesg | null
  profileSamples: GarminProfileSample[]
  gases: GarminGas[]
  maximumPpo2: number | null
  profileVersion: string
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function selectSession(messages: FitMessages): SessionMesg | null {
  return (
    messages.sessionMesgs?.find(
      (session) =>
        session.sport === 'diving' ||
        (typeof session.subSport === 'string' && DIVING_SUB_SPORTS.has(session.subSport)),
    ) ??
    messages.sessionMesgs?.[0] ??
    null
  )
}

function mapProfile(
  records: RecordMesg[],
  session: SessionMesg | null,
): GarminProfileSample[] {
  const firstRecordTime = records.map((item) => dateValue(item.timestamp)).find(Boolean)
  const startedAt = dateValue(session?.startTime) ?? firstRecordTime ?? null
  if (!startedAt) return []
  const byElapsed = new Map<number, GarminProfileSample>()
  for (const item of records) {
    const timestamp = dateValue(item.timestamp)
    const depth = finite(item.depth)
    if (!timestamp || depth === null || depth < 0) continue
    const elapsedSeconds = Math.max(
      0,
      Math.round((timestamp.getTime() - startedAt.getTime()) / 1_000),
    )
    byElapsed.set(elapsedSeconds, {
      elapsedSeconds,
      depthMeters: depth,
      temperatureCelsius: finite(item.temperature),
      decoCeilingMeters: finite(item.nextStopDepth),
    })
  }
  return [...byElapsed.values()].sort(
    (left, right) => left.elapsedSeconds - right.elapsedSeconds,
  )
}

function mapGases(messages: DiveGasMesg[]): GarminGas[] {
  return messages.map((gas, index) => ({
    index:
      typeof gas.messageIndex === 'number' && Number.isInteger(gas.messageIndex)
        ? gas.messageIndex
        : index,
    oxygenPercent: finite(gas.oxygenContent),
    heliumPercent: finite(gas.heliumContent),
    mode: typeof gas.mode === 'string' ? gas.mode : null,
    status: typeof gas.status === 'string' ? gas.status : null,
  }))
}

export function mapDecodedGarminFit(
  messages: FitMessages,
  profileVersion = 'unknown',
): DecodedGarminFit {
  const session = selectSession(messages)
  const summary = messages.diveSummaryMesgs?.[0] ?? null
  const isDive = Boolean(
    session &&
      (session.sport === 'diving' ||
        (typeof session.subSport === 'string' &&
          DIVING_SUB_SPORTS.has(session.subSport))),
  )
  const po2Values = (messages.recordMesgs ?? [])
    .map((item) => finite(item.po2))
    .filter((value): value is number => value !== null)
  return {
    isDive,
    session,
    summary,
    profileSamples: mapProfile(messages.recordMesgs ?? [], session),
    gases: mapGases(messages.diveGasMesgs ?? []),
    maximumPpo2: po2Values.length > 0 ? Math.max(...po2Values) : null,
    profileVersion,
  }
}

export function decodeGarminFit(bytes: Uint8Array): DecodedGarminFit {
  const stream = Stream.fromByteArray(bytes)
  if (!Decoder.isFIT(stream)) throw new Error('Garmin activity file is not FIT data')
  const decoder = new Decoder(stream)
  if (!decoder.checkIntegrity())
    throw new Error('Garmin FIT file failed integrity checks')
  const { messages, errors, profileVersion } = decoder.read({
    applyScaleAndOffset: true,
    expandSubFields: true,
    expandComponents: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    includeUnknownData: false,
  })
  if (errors.length > 0) {
    throw new Error(
      `Garmin FIT decode failed: ${errors.map((error) => error.message).join('; ')}`,
    )
  }
  return mapDecodedGarminFit(messages, `${profileVersion.major}.${profileVersion.minor}`)
}
