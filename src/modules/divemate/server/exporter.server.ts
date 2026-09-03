import '@tanstack/react-start/server-only'

import type { ExportSnapshot } from '@/modules/export/types'
import { encodeDiveMateProfile } from '../export-profile'
import { formatDiveMateInstructor } from '../instructor'
import type { SqliteBinding, SqliteDatabase } from './sqlite.server'

function binding(value: unknown): SqliteBinding {
  if (value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 1 : 0
  return value as SqliteBinding
}

function hasTable(database: SqliteDatabase, name: string) {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name),
  )
}

function replaceTable(
  database: SqliteDatabase,
  table: string,
  rows: Array<Record<string, unknown>>,
) {
  if (!hasTable(database, table)) {
    if (rows.length > 0) throw new Error(`DiveMate template is missing ${table}`)
    return
  }
  const columns = new Set(
    (
      database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>
    ).map((column) => column.name),
  )
  database.prepare(`DELETE FROM "${table}"`).run()
  for (const row of rows) {
    const entries = Object.entries(row).filter(([name]) => columns.has(name))
    if (entries.length === 0) continue
    const names = entries.map(([name]) => `"${name}"`).join(', ')
    const placeholders = entries.map(() => '?').join(', ')
    database
      .prepare(`INSERT INTO "${table}" (${names}) VALUES (${placeholders})`)
      .run(...entries.map(([, value]) => binding(value)))
  }
}

interface SourceIdentity {
  id: string
}

function assignDiveMateIds<T extends SourceIdentity>(rows: T[]) {
  const result = new Map<string, number>()
  const used = new Set<number>()
  let next = 1
  for (const row of [...rows].sort((left, right) => left.id.localeCompare(right.id))) {
    if (result.has(row.id)) continue
    while (used.has(next)) next += 1
    result.set(row.id, next)
    used.add(next)
    next += 1
  }
  return result
}

function minutes(seconds: number | null) {
  return seconds === null ? null : Math.round((seconds / 60) * 100) / 100
}

function interval(seconds: number | null) {
  if (seconds === null) return null
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function coordinate(value: string | null, latitude: boolean) {
  if (value === null) return null
  const decimal = Number(value)
  const limit = latitude ? 90 : 180
  if (!Number.isFinite(decimal) || Math.abs(decimal) > limit) return null
  const absolute = Math.abs(decimal)
  const degrees = Math.floor(absolute)
  const minutesValue = (absolute - degrees) * 60
  const coordinateMinutes = Math.floor(minutesValue)
  const seconds = (minutesValue - coordinateMinutes) * 60
  const direction = latitude ? (decimal < 0 ? 'S' : 'N') : decimal < 0 ? 'W' : 'E'
  return `${degrees}°${String(coordinateMinutes).padStart(2, '0')}'${seconds.toFixed(2)}"${direction}`
}

export function rewriteDiveMateDatabase(
  database: SqliteDatabase,
  snapshot: ExportSnapshot,
) {
  const data = snapshot.data
  const buddiesById = new Map(data.buddies.map((buddy) => [buddy.id, buddy]))
  const buddyAgencyNumbers = new Map(
    data.buddyAgencyMemberships.map((membership) => [
      `${membership.buddyId}:${membership.agencyId}`,
      membership.memberNumber,
    ]),
  )
  const diverIds = assignDiveMateIds(data.divers)
  const siteIds = assignDiveMateIds(data.diveSites)
  const buddyIds = assignDiveMateIds(data.buddies)
  const equipmentIds = assignDiveMateIds([...data.equipment, ...data.equipmentSets])
  const certificationIds = assignDiveMateIds(data.certifications)
  const shopIds = assignDiveMateIds(data.shops)
  const diveTypeIds = assignDiveMateIds(data.diveTypes)
  const diveIds = assignDiveMateIds(data.dives)
  const tankIds = assignDiveMateIds(data.tanks)
  const pictureIds = assignDiveMateIds(data.pictures)
  const buddyIdsByDive = new Map<string, number[]>()
  const buddyNamesByDive = new Map<string, string[]>()
  for (const relation of data.diveBuddies) {
    const id = buddyIds.get(relation.buddyId)
    if (id) {
      buddyIdsByDive.set(relation.diveId, [
        ...(buddyIdsByDive.get(relation.diveId) ?? []),
        id,
      ])
    }
    const name = formatDiveMateInstructor(buddiesById.get(relation.buddyId))
    if (name) {
      buddyNamesByDive.set(relation.diveId, [
        ...(buddyNamesByDive.get(relation.diveId) ?? []),
        name,
      ])
    }
  }
  const equipmentIdsByDive = new Map<string, number[]>()
  for (const relation of data.diveEquipment) {
    const id = equipmentIds.get(relation.equipmentId)
    if (id) {
      equipmentIdsByDive.set(relation.diveId, [
        ...(equipmentIdsByDive.get(relation.diveId) ?? []),
        id,
      ])
    }
  }
  const equipmentIdsBySet = new Map<string, number[]>()
  for (const relation of [...data.equipmentSetItems].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  )) {
    const id = equipmentIds.get(relation.equipmentId)
    if (id) {
      equipmentIdsBySet.set(relation.equipmentSetId, [
        ...(equipmentIdsBySet.get(relation.equipmentSetId) ?? []),
        id,
      ])
    }
  }
  const samplesByDive = new Map<string, Array<(typeof data.diveProfileSamples)[number]>>()
  for (const sample of data.diveProfileSamples) {
    samplesByDive.set(sample.diveId, [
      ...(samplesByDive.get(sample.diveId) ?? []),
      sample,
    ])
  }

  database.exec('PRAGMA foreign_keys = OFF')
  try {
    database.transaction(() => {
      replaceTable(
        database,
        'Personal',
        data.divers.map((row) => ({
          ID: diverIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          FirstName: row.firstName,
          LastName: row.lastName,
          Email: row.email,
          Mobile: row.phone,
          Street: row.street,
          Zip: row.postalCode,
          City: row.city,
          State: row.state,
          Country: row.country,
          Birthdate: row.birthDate,
          Bloodgroup: row.bloodGroup,
          EmergContact: row.emergencyContact,
          EmergContactNumber: row.emergencyPhone,
          EmergEmail: row.emergencyEmail,
          DiveInsurance: row.insurance,
          Comments: row.notes,
        })),
      )
      replaceTable(
        database,
        'Place',
        data.diveSites.map((row) => ({
          ID: siteIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          Place: row.name,
          Country: row.country,
          Region: row.region,
          WaterName: row.waterName,
          Lat: coordinate(row.latitude, true),
          Lon: coordinate(row.longitude, false),
          MaxDepth: row.maximumDepthMeters,
          Altitude: row.altitudeMeters,
          Difficulty: row.difficulty,
          Rating: row.rating,
          Water: row.waterType,
          Comments: row.notes,
        })),
      )
      replaceTable(
        database,
        'Buddy',
        data.buddies.map((row) => ({
          ID: buddyIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          FirstName: row.firstName,
          LastName: row.lastName,
          Email: row.email,
          Mobile: row.phone,
          Street: row.street,
          Zip: row.postalCode,
          City: row.city,
          State: row.state,
          Country: row.country,
          Comments: row.notes,
        })),
      )
      replaceTable(
        database,
        'Shop',
        data.shops.map((row) => ({
          ID: shopIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          ShopName: row.name,
        })),
      )
      replaceTable(
        database,
        'Divetype',
        data.diveTypes.map((row) => ({
          ID: diveTypeIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          Typename: row.name,
          SortOrd: row.sortOrder,
        })),
      )
      replaceTable(database, 'Equipment', [
        ...data.equipment.map((row) => ({
          ID: equipmentIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          DiverID: row.diverId ? diverIds.get(row.diverId) : null,
          Name: row.name,
          Category: row.category,
          Manufacturer: row.manufacturer,
          Object: row.model,
          Serial: row.serialNumber,
          Info: row.information,
          DateP: row.purchasedAt,
          Price: row.purchasePrice,
          Shop: row.purchaseShop,
          DateR: row.retiredAt,
          DateRN: row.serviceDueAt,
          Inactive: row.inactive,
          Weight: row.weightKg,
          Comments: row.notes,
        })),
        ...data.equipmentSets.map((row) => ({
          ID: equipmentIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          Name: row.name,
          Category: '---SET',
          TypeID: 9,
          Info: (equipmentIdsBySet.get(row.id) ?? []).join(','),
          Inactive: row.inactive,
          Comments: row.notes,
        })),
      ])
      replaceTable(
        database,
        'Brevets',
        data.certifications.map((row) => ({
          ID: certificationIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          DiverID: row.diverId ? diverIds.get(row.diverId) : null,
          Brevet: row.name,
          Org: row.organization,
          Number: row.certificationNumber,
          CertDate: row.certifiedAt,
          Instructor: formatDiveMateInstructor(
            row.instructorBuddyId ? buddiesById.get(row.instructorBuddyId) : null,
          ),
          InstructorNo:
            row.instructorBuddyId && row.agencyId
              ? (buddyAgencyNumbers.get(`${row.instructorBuddyId}:${row.agencyId}`) ??
                null)
              : null,
          SortOrd: row.sortOrder,
          Scan1Path: row.scan1Path,
          Scan2Path: row.scan2Path,
        })),
      )
      replaceTable(
        database,
        'Logbook',
        data.dives.map((row) => {
          const profile = encodeDiveMateProfile(samplesByDive.get(row.id) ?? [])
          return {
            ID: diveIds.get(row.id),
            UUID: row.id,
            Updated: row.updatedAt,
            DiverID: row.diverId ? diverIds.get(row.diverId) : null,
            PlaceID: row.siteId ? siteIds.get(row.siteId) : null,
            ShopID: row.shopId ? shopIds.get(row.shopId) : null,
            TypeOfDive: row.diveTypeId ? diveTypeIds.get(row.diveTypeId) : null,
            BuddyIDs: (buddyIdsByDive.get(row.id) ?? []).join(','),
            UsedEquip: (equipmentIdsByDive.get(row.id) ?? []).join(','),
            Status: row.captureSource === 'computer' ? 1 : 0,
            Number: row.number,
            Divedate: row.diveDate,
            Entrytime: row.entryTime,
            UTCoffset: row.utcOffsetMinutes,
            Divetime: minutes(row.durationSeconds),
            Surfint: interval(row.surfaceIntervalSeconds),
            Depth: row.maximumDepthMeters,
            DepthAvg: row.averageDepthMeters,
            Airtemp: row.airTemperatureCelsius,
            Watertemp: row.waterTemperatureCelsius,
            Weight: row.weightKg,
            EquipWeight: row.equipmentWeightKg,
            MaxPPO2: row.maximumPpo2,
            Deco: row.decompressionDive,
            VisHor: row.visibility,
            UWCurrent: row.current,
            Waves: row.waves,
            Weather: row.weather,
            Water: row.waterType,
            Entry: row.entryType,
            Rating: row.rating,
            Computer: row.computer,
            Divesuit: row.suit,
            Boat: row.boat,
            Divemaster: row.divemaster,
            Buddy: buddyNamesByDive.get(row.id)?.[0] ?? null,
            Comments: row.notes,
            ProfileInt: profile.profileIntervalSeconds,
            Profile: profile.profile,
            Profile2: profile.profile2,
            Profile3: profile.profile3,
            Profile4: profile.profile4,
          }
        }),
      )
      replaceTable(
        database,
        'Tank',
        data.tanks.map((row) => ({
          ID: tankIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          LogID: diveIds.get(row.diveId),
          Name: row.name,
          SortOrd: row.sortOrder,
          TankID: row.computerTankNumber,
          Tanksize: row.volumeLiters,
          PresS: row.startPressureBar,
          PresE: row.endPressureBar,
          PresW: row.workingPressureBar,
          O2: row.oxygenPercent,
          He: row.heliumPercent,
          BreathingTime: row.breathingTimeSeconds,
          Weight: row.weightKg,
        })),
      )
      replaceTable(
        database,
        'Pictures',
        data.pictures.map((row) => ({
          ID: pictureIds.get(row.id),
          UUID: row.id,
          Updated: row.updatedAt,
          LogID: row.diveId ? diveIds.get(row.diveId) : null,
          PlaceID: row.siteId ? siteIds.get(row.siteId) : null,
          BuddyID: row.buddyId ? buddyIds.get(row.buddyId) : null,
          EquipmentID: row.equipmentId ? equipmentIds.get(row.equipmentId) : null,
          DiverID: row.diverId ? diverIds.get(row.diverId) : null,
          Path: row.path,
          Description: row.description,
          SortOrd: row.sortOrder,
        })),
      )
      if (hasTable(database, 'DBInfo')) {
        const columns = new Set(
          (
            database.prepare('PRAGMA table_info("DBInfo")').all() as Array<{
              name: string
            }>
          ).map((column) => column.name),
        )
        const candidates: Array<[string, SqliteBinding]> = [
          ['PrgName', 'Divetracx'],
          ['Updated', snapshot.exportedAt],
        ]
        const assignments = candidates.filter(([name]) => columns.has(name))
        if (assignments.length > 0) {
          database
            .prepare(
              `UPDATE "DBInfo" SET ${assignments
                .map(([name]) => `"${name}" = ?`)
                .join(', ')}`,
            )
            .run(...assignments.map(([, value]) => value))
        }
      }
    })()
  } finally {
    database.exec('PRAGMA foreign_keys = ON')
  }
}
