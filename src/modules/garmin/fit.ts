import type {
  DiveGasMesg,
  DiveSummaryMesg,
  FitMessages,
  RecordMesg,
  SessionMesg,
} from '@garmin/fitsdk'
import { Decoder, Stream } from '@garmin/fitsdk'
import { garminAlertLabel, isGarminAlertDismissal } from '@/modules/dives/dive-events'
import type {
  GarminDecoSettings,
  GarminDevice,
  GarminDiveEvent,
  GarminGas,
  GarminProfileSample,
} from './types'

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
  events: GarminDiveEvent[]
  device: GarminDevice | null
  deco: GarminDecoSettings | null
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
    const heartRate = finite(item.heartRate)
    const ndl = finite(item.ndlTime)
    byElapsed.set(elapsedSeconds, {
      elapsedSeconds,
      depthMeters: depth,
      temperatureCelsius: finite(item.temperature),
      decoCeilingMeters: finite(item.nextStopDepth),
      // 0 and 255 are the FIT "no reading" sentinels for optical wrist HR.
      heartRateBpm:
        heartRate !== null && heartRate > 0 && heartRate < 255 ? heartRate : null,
      // The watch writes no NDL once the diver is in deco; a huge value means
      // "no limit within range" and is not worth plotting.
      ndlSeconds: ndl !== null && ndl < 36_000 ? Math.round(ndl) : null,
      timeToSurfaceSeconds: roundOrNull(finite(item.timeToSurface)),
      cnsPercent: roundOrNull(finite(item.cnsLoad)),
      nitrogenLoadPercent: roundOrNull(finite(item.n2Load)),
    })
  }
  return [...byElapsed.values()].sort(
    (left, right) => left.elapsedSeconds - right.elapsedSeconds,
  )
}

function roundOrNull(value: number | null) {
  return value === null ? null : Math.round(value)
}

/**
 * Gas switches and alerts, as the computer flagged them. Alert dismissals are
 * dropped; the alert itself is what happened on the dive.
 */
function mapEvents(messages: FitMessages, startedAt: Date | null): GarminDiveEvent[] {
  if (!startedAt) return []
  const events: GarminDiveEvent[] = []
  for (const item of messages.eventMesgs ?? []) {
    const timestamp = dateValue(item.timestamp)
    if (!timestamp) continue
    const elapsedSeconds = Math.max(
      0,
      Math.round((timestamp.getTime() - startedAt.getTime()) / 1_000),
    )
    if (item.event === 'diveGasSwitched') {
      const gasIndex = finite(item.data)
      const tankNumber = gasIndex === null ? null : gasIndex + 1
      events.push({
        elapsedSeconds,
        kind: 'gas_switch',
        code: 'diveGasSwitched',
        label: tankNumber === null ? 'Gas switch' : `Switched to gas ${tankNumber}`,
        tankNumber,
      })
      continue
    }
    if (item.event === 'diveAlert') {
      const code =
        typeof item.diveAlert === 'string'
          ? item.diveAlert
          : item.diveAlert === undefined
            ? null
            : String(item.diveAlert)
      if (!code || isGarminAlertDismissal(code)) continue
      events.push({
        elapsedSeconds,
        kind: 'alert',
        code,
        label: garminAlertLabel(code),
        tankNumber: null,
      })
    }
  }
  // A gas switch at second 0 is the starting gas, not a switch.
  return events.filter(
    (event) => !(event.kind === 'gas_switch' && event.elapsedSeconds === 0),
  )
}

function mapDevice(messages: FitMessages): GarminDevice | null {
  const infos = messages.deviceInfoMesgs ?? []
  const creator =
    infos.find((item) => item.deviceIndex === 'creator' || item.deviceIndex === 0) ??
    infos[0]
  if (!creator) return null
  const product =
    typeof creator.garminProduct === 'string'
      ? creator.garminProduct
      : typeof creator.productName === 'string'
        ? creator.productName
        : null
  const serial = finite(creator.serialNumber)
  const software = finite(creator.softwareVersion)
  return {
    product: product ? formatGarminProductName(product) : null,
    serialNumber: serial === null ? null : String(serial),
    softwareVersion: software === null ? null : software.toFixed(2),
  }
}

/** `descentMk3` → `Descent Mk3`, `descentMk2i` → `Descent Mk2i`. */
function formatGarminProductName(raw: string) {
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function mapDecoSettings(messages: FitMessages): GarminDecoSettings | null {
  const settings = messages.diveSettingsMesgs?.[0]
  if (!settings) return null
  const model = typeof settings.model === 'string' ? settings.model : null
  return {
    model: model === 'zhl16c' ? 'ZHL-16C' : model,
    gradientFactorLow: roundOrNull(finite(settings.gfLow)),
    gradientFactorHigh: roundOrNull(finite(settings.gfHigh)),
    waterType:
      settings.waterType === 'fresh'
        ? 'fresh'
        : settings.waterType === 'salt' || settings.waterType === 'en13319'
          ? 'salt'
          : null,
  }
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
    role: null,
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
  const startedAt =
    dateValue(session?.startTime) ??
    (messages.recordMesgs ?? []).map((item) => dateValue(item.timestamp)).find(Boolean) ??
    null
  return {
    isDive,
    session,
    summary,
    profileSamples: mapProfile(messages.recordMesgs ?? [], session),
    gases: mapGases(messages.diveGasMesgs ?? []),
    events: mapEvents(messages, startedAt),
    device: mapDevice(messages),
    deco: mapDecoSettings(messages),
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
