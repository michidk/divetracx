import { Database } from 'bun:sqlite'
import type {
  DiveMateBuddy,
  DiveMateCertification,
  DiveMateDive,
  DiveMateDiver,
  DiveMateDiveType,
  DiveMateEquipment,
  DiveMateProfileSample,
  DiveMateShop,
  DiveMateSite,
  DiveMateSnapshot,
  DiveMateSourceRecord,
  DiveMateTank,
} from './types'

type SourceRow = Record<string, unknown>

function hasTable(database: Database, name: string): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
      .get(name),
  )
}

function readRows(database: Database, table: string): SourceRow[] {
  if (!hasTable(database, table)) return []
  return database.prepare(`SELECT * FROM "${table}"`).all() as SourceRow[]
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function integer(value: unknown): number | null {
  const parsed = number(value)
  return parsed === null ? null : Math.round(parsed)
}

function decimal(value: unknown, allowZero = false): string | null {
  const parsed = number(value)
  if (parsed === null || (allowZero ? parsed < 0 : parsed <= 0)) return null
  return String(parsed)
}

function date(value: unknown): string | null {
  const normalized = text(value)
  if (!normalized) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  if (/^\d{8}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`
  }
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function clockTime(value: unknown): string | null {
  const normalized = text(value)
  if (!normalized) return null
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? 0)
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function durationSeconds(value: unknown): number {
  const minutes = number(value)
  if (minutes === null || minutes <= 0) return 0
  return Math.round(minutes * 60)
}

function intervalSeconds(value: unknown): number | null {
  const normalized = text(value)
  if (!normalized) return null
  const parts = normalized.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 2) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
  }
  return null
}

function externalId(value: unknown): string | null {
  const parsed = integer(value)
  return parsed === null ? null : String(parsed)
}

function idList(value: unknown): string[] {
  const normalized = text(value)
  if (!normalized) return []
  return [...new Set(normalized.match(/\d+/g) ?? [])]
}

function coordinate(value: unknown, latitude: boolean): string | null {
  const normalized = text(value)
  if (!normalized) return null

  const direct = Number(normalized.replace(',', '.'))
  if (Number.isFinite(direct)) {
    const limit = latitude ? 90 : 180
    return Math.abs(direct) <= limit ? direct.toFixed(7) : null
  }

  const match = normalized.match(
    /^(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.,]+)["″]?\s*([NSEW])$/i,
  )
  if (!match) return null
  const degrees = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number((match[3] ?? '').replace(',', '.'))
  const direction = match[4]?.toUpperCase()
  const limit = latitude ? 90 : 180
  if (
    !Number.isFinite(degrees) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    degrees > limit ||
    minutes >= 60 ||
    seconds >= 60 ||
    (latitude
      ? direction !== 'N' && direction !== 'S'
      : direction !== 'E' && direction !== 'W')
  ) {
    return null
  }
  const sign = direction === 'S' || direction === 'W' ? -1 : 1
  return (sign * (degrees + minutes / 60 + seconds / 3600)).toFixed(7)
}

function sourcePayload(row: SourceRow): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Uint8Array) {
        return [key, { omittedBinaryBytes: value.byteLength }]
      }
      return [key, value]
    }),
  )
}

function sourceRecord(row: SourceRow): DiveMateSourceRecord | null {
  const id = externalId(row.ID)
  if (!id) return null
  return {
    externalId: id,
    externalUuid: text(row.UUID),
    sourceUpdatedAt: text(row.Updated),
    sourcePayload: sourcePayload(row),
  }
}

function mapDiver(row: SourceRow): DiveMateDiver | null {
  const source = sourceRecord(row)
  if (!source) return null
  return {
    ...source,
    firstName: text(row.FirstName),
    lastName: text(row.LastName),
    email: text(row.Email),
    phone: text(row.Mobile) ?? text(row.Phone),
    birthDate: date(row.Birthdate),
    bloodGroup: text(row.Bloodgroup),
    emergencyContact: text(row.EmergContact),
    emergencyPhone: text(row.EmergContactNumber),
    insurance: text(row.DiveInsurance),
    notes: text(row.Comments),
  }
}

function mapSite(row: SourceRow): DiveMateSite | null {
  const source = sourceRecord(row)
  const name = text(row.Place)
  if (!source || !name) return null
  return {
    ...source,
    name,
    country: text(row.Country),
    region: text(row.Region),
    waterName: text(row.WaterName),
    latitude: coordinate(row.Lat, true),
    longitude: coordinate(row.Lon, false),
    sourceLatitude: text(row.Lat),
    sourceLongitude: text(row.Lon),
    maximumDepthMeters: decimal(row.MaxDepth),
    altitudeMeters: integer(row.Altitude),
    difficulty: text(row.Difficulty),
    rating: integer(row.Rating),
    waterType: integer(row.Water),
    notes: text(row.Comments),
  }
}

function mapBuddy(row: SourceRow): DiveMateBuddy | null {
  const source = sourceRecord(row)
  if (!source) return null
  return {
    ...source,
    firstName: text(row.FirstName),
    lastName: text(row.LastName),
    email: text(row.Email),
    phone: text(row.Mobile) ?? text(row.Phone),
    city: text(row.City),
    country: text(row.Country),
    notes: text(row.Comments),
  }
}

function mapEquipment(row: SourceRow): DiveMateEquipment | null {
  const source = sourceRecord(row)
  if (!source) return null
  const name =
    text(row.Name) ?? text(row.Object) ?? `DiveMate equipment ${source.externalId}`
  return {
    ...source,
    name,
    category: text(row.Category),
    manufacturer: text(row.Manufacturer),
    model: text(row.Object),
    serialNumber: text(row.Serial),
    purchasedAt: date(row.DateP),
    retiredAt: date(row.DateR),
    serviceDueAt: date(row.DateRN),
    inactive: integer(row.Inactive) === 1,
    weightKg: decimal(row.Weight),
    notes: text(row.Comments),
  }
}

function mapCertification(row: SourceRow): DiveMateCertification | null {
  const source = sourceRecord(row)
  const name = text(row.Brevet)
  if (!source || !name) return null
  return {
    ...source,
    diverExternalId: externalId(row.DiverID),
    name,
    organization: text(row.Org),
    certificationNumber: text(row.Number),
    certifiedAt: date(row.CertDate),
    instructorName: text(row.Instructor),
    instructorNumber: text(row.InstructorNo),
  }
}

function mapShop(row: SourceRow): DiveMateShop | null {
  const source = sourceRecord(row)
  const name = text(row.ShopName)
  return source && name ? { ...source, name } : null
}

function mapDiveType(row: SourceRow): DiveMateDiveType | null {
  const source = sourceRecord(row)
  const name = text(row.Typename)
  return source && name ? { ...source, name, sortOrder: integer(row.SortOrd) } : null
}

function mapDive(row: SourceRow): DiveMateDive | null {
  const source = sourceRecord(row)
  const diveDate = date(row.Divedate)
  if (!source || !diveDate) return null
  return {
    ...source,
    diverExternalId: externalId(row.DiverID),
    siteExternalId: externalId(row.PlaceID),
    shopExternalId: externalId(row.ShopID),
    diveTypeExternalId: externalId(row.TypeOfDive),
    buddyExternalIds: idList(row.BuddyIDs),
    equipmentExternalIds: idList(row.UsedEquip),
    number: integer(row.Number),
    diveDate,
    entryTime: clockTime(row.Entrytime),
    utcOffsetMinutes: integer(row.UTCoffset),
    durationSeconds: durationSeconds(row.Divetime),
    surfaceIntervalSeconds: intervalSeconds(row.Surfint),
    maximumDepthMeters: decimal(row.Depth),
    averageDepthMeters: decimal(row.DepthAvg),
    airTemperatureCelsius: decimal(row.Airtemp, true),
    waterTemperatureCelsius: decimal(row.Watertemp, true),
    weightKg: decimal(row.Weight),
    visibility: text(row.VisHor),
    current: text(row.UWCurrent),
    waves: text(row.Waves),
    weather: text(row.Weather),
    waterType: integer(row.Water),
    entryType: integer(row.Entry),
    rating: integer(row.Rating),
    computer: text(row.Computer),
    suit: text(row.Divesuit),
    boat: text(row.Boat),
    divemaster: text(row.Divemaster),
    notes: text(row.Comments),
  }
}

function mapTank(row: SourceRow): DiveMateTank | null {
  const source = sourceRecord(row)
  const diveExternalId = externalId(row.LogID)
  if (!source || !diveExternalId) return null
  return {
    ...source,
    diveExternalId,
    name: text(row.Name),
    sortOrder: integer(row.SortOrd),
    tankType: integer(row.Tanktype),
    volumeLiters: decimal(row.Tanksize),
    startPressureBar: decimal(row.PresS),
    endPressureBar: decimal(row.PresE),
    oxygenPercent: decimal(row.O2, true),
    heliumPercent: decimal(row.He, true),
    breathingTimeSeconds: integer(row.BreathingTime),
  }
}

const PROFILE_SAMPLE_WIDTH = 12
const PROFILE_DEPTH_WIDTH = 4

function mapProfileSamples(row: SourceRow): DiveMateProfileSample[] {
  const diveExternalId = externalId(row.ID)
  const profile = text(row.Profile)
  const profileIntervalSeconds = integer(row.ProfileInt)
  if (
    !diveExternalId ||
    !profile ||
    !profileIntervalSeconds ||
    profileIntervalSeconds <= 0 ||
    profile.length % PROFILE_SAMPLE_WIDTH !== 0 ||
    !/^\d+$/.test(profile)
  ) {
    return []
  }

  const externalUuid = text(row.UUID)
  const sourceUpdatedAt = text(row.Updated)
  return Array.from(
    { length: profile.length / PROFILE_SAMPLE_WIDTH },
    (_, sampleIndex) => {
      const offset = sampleIndex * PROFILE_SAMPLE_WIDTH
      const rawSample = profile.slice(offset, offset + PROFILE_SAMPLE_WIDTH)
      const depthTenths = Number(rawSample.slice(0, PROFILE_DEPTH_WIDTH))
      return {
        diveExternalId,
        sampleIndex,
        elapsedSeconds: sampleIndex * profileIntervalSeconds,
        depthMeters: (depthTenths / 10).toFixed(1),
        externalId: `${diveExternalId}:${sampleIndex}`,
        externalUuid,
        sourceUpdatedAt,
        sourcePayload: {
          rawSample,
          profileIntervalSeconds,
        },
      }
    },
  )
}

function compact<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item !== null)
}

export function parseDiveMateDatabase(databasePath: string): DiveMateSnapshot {
  const database = new Database(databasePath, { readonly: true })
  try {
    const info = readRows(database, 'DBInfo')[0]
    return {
      databaseVersion: text(info?.DBVersion),
      divers: compact(readRows(database, 'Personal').map(mapDiver)),
      sites: compact(readRows(database, 'Place').map(mapSite)),
      buddies: compact(readRows(database, 'Buddy').map(mapBuddy)),
      equipment: compact(readRows(database, 'Equipment').map(mapEquipment)),
      certifications: compact(readRows(database, 'Brevets').map(mapCertification)),
      shops: compact(readRows(database, 'Shop').map(mapShop)),
      diveTypes: compact(readRows(database, 'Divetype').map(mapDiveType)),
      dives: compact(readRows(database, 'Logbook').map(mapDive)),
      tanks: compact(readRows(database, 'Tank').map(mapTank)),
      profileSamples: readRows(database, 'Logbook').flatMap(mapProfileSamples),
    }
  } finally {
    database.close()
  }
}
