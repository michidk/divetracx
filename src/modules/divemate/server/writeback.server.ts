import '@tanstack/react-start/server-only'

import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getServerEnv } from '@/env'
import { loadExportSnapshot } from '@/modules/export/server/snapshot.server'
import { openGoogleDriveBackup } from './google-drive.server'
import { openSqlite, type SqliteBinding, type SqliteDatabase } from './sqlite.server'

const SOURCE_KEY = 'divemate'

function minutes(seconds: number | null) {
  return seconds === null ? null : Math.round((seconds / 60) * 100) / 100
}

function interval(seconds: number | null) {
  if (seconds === null) return null
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function updateExisting(
  database: SqliteDatabase,
  table: string,
  externalId: string | null,
  values: Record<string, unknown>,
) {
  if (!externalId) return 0
  const columns = new Set(
    (
      database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>
    ).map((column) => column.name),
  )
  const entries = Object.entries(values).filter(([name]) => columns.has(name))
  if (entries.length === 0) return 0
  const assignments = entries.map(([name]) => `"${name}" = ?`).join(', ')
  const bindings = entries.map(([, value]): SqliteBinding => {
    if (value === undefined) return null
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'boolean') return value ? 1 : 0
    return value as SqliteBinding
  })
  const result = database
    .prepare(`UPDATE "${table}" SET ${assignments} WHERE "ID" = ?`)
    .run(...bindings, externalId)
  return Number(result.changes)
}

export interface DiveMateWriteBackResult {
  updatedRecords: number
  skippedLocalRecords: number
  driveFileId: string
}

export type DiveMateWriteBackStage =
  | 'reading-drive'
  | 'reading-divetracx'
  | 'updating-database'
  | 'uploading-drive'

export interface DiveMateWriteBackStatus {
  id: string
  state: 'running' | 'succeeded' | 'failed'
  stage: DiveMateWriteBackStage
  startedAt: string
  finishedAt: string | null
  result: DiveMateWriteBackResult | null
  error: string | null
}

const writeBackState = globalThis as typeof globalThis & {
  __divetracxWriteBack?: DiveMateWriteBackStatus
}

function setStage(stage: DiveMateWriteBackStage) {
  if (writeBackState.__divetracxWriteBack?.state === 'running')
    writeBackState.__divetracxWriteBack.stage = stage
}

export async function writeBackDiveMate(): Promise<DiveMateWriteBackResult> {
  const environment = getServerEnv()
  if (!environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('DIVEMATE_GOOGLE_DRIVE_FOLDER_ID is not configured')
  }
  setStage('reading-drive')
  const drivePromise = openGoogleDriveBackup(
    environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID,
    environment.DIVEMATE_MAX_BACKUP_BYTES,
  )
  setStage('reading-divetracx')
  const snapshotPromise = loadExportSnapshot()
  const [drive, snapshot] = await Promise.all([drivePromise, snapshotPromise])
  const directory = await mkdtemp(join(tmpdir(), 'divetracx-writeback-'))
  const path = join(directory, 'DiveMate.ddb')
  try {
    await writeFile(path, drive.database)
    setStage('updating-database')
    const database = await openSqlite(path)
    let updatedRecords = 0
    let skippedLocalRecords = 0
    const imported = <T extends { sourceKey: string | null; externalId: string | null }>(
      rows: T[],
    ) => {
      skippedLocalRecords += rows.filter(
        (row) => row.sourceKey !== SOURCE_KEY || !row.externalId,
      ).length
      return rows.filter(
        (row): row is T & { externalId: string } =>
          row.sourceKey === SOURCE_KEY && Boolean(row.externalId),
      )
    }
    const externalById = new Map<string, string>()
    for (const collection of [
      snapshot.data.divers,
      snapshot.data.diveSites,
      snapshot.data.buddies,
      snapshot.data.equipment,
      snapshot.data.shops,
      snapshot.data.diveTypes,
      snapshot.data.dives,
    ]) {
      for (const row of collection) {
        if (row.sourceKey === SOURCE_KEY && row.externalId)
          externalById.set(row.id, row.externalId)
      }
    }
    const buddyIdsByDive = new Map<string, string[]>()
    for (const relation of snapshot.data.diveBuddies) {
      const external = externalById.get(relation.buddyId)
      if (external)
        buddyIdsByDive.set(relation.diveId, [
          ...(buddyIdsByDive.get(relation.diveId) ?? []),
          external,
        ])
    }
    const equipmentIdsByDive = new Map<string, string[]>()
    for (const relation of snapshot.data.diveEquipment) {
      const external = externalById.get(relation.equipmentId)
      if (external)
        equipmentIdsByDive.set(relation.diveId, [
          ...(equipmentIdsByDive.get(relation.diveId) ?? []),
          external,
        ])
    }

    database.transaction(() => {
      for (const row of imported(snapshot.data.divers))
        updatedRecords += updateExisting(database, 'Personal', row.externalId, {
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
        })
      for (const row of imported(snapshot.data.diveSites))
        updatedRecords += updateExisting(database, 'Place', row.externalId, {
          Place: row.name,
          Country: row.country,
          Region: row.region,
          WaterName: row.waterName,
          Lat: row.latitude,
          Lon: row.longitude,
          MaxDepth: row.maximumDepthMeters,
          Altitude: row.altitudeMeters,
          Difficulty: row.difficulty,
          Rating: row.rating,
          Water: row.waterType,
          Comments: row.notes,
        })
      for (const row of imported(snapshot.data.buddies))
        updatedRecords += updateExisting(database, 'Buddy', row.externalId, {
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
        })
      for (const row of imported(snapshot.data.shops))
        updatedRecords += updateExisting(database, 'Shop', row.externalId, {
          ShopName: row.name,
        })
      for (const row of imported(snapshot.data.diveTypes))
        updatedRecords += updateExisting(database, 'Divetype', row.externalId, {
          Typename: row.name,
          SortOrd: row.sortOrder,
        })
      for (const row of imported(snapshot.data.certifications))
        updatedRecords += updateExisting(database, 'Brevets', row.externalId, {
          DiverID: row.diverId ? externalById.get(row.diverId) : null,
          Brevet: row.name,
          Org: row.organization,
          Number: row.certificationNumber,
          CertDate: row.certifiedAt,
          Instructor: row.instructorName,
          InstructorNo: row.instructorNumber,
          SortOrd: row.sortOrder,
          Scan1Path: row.scan1Path,
          Scan2Path: row.scan2Path,
        })
      for (const row of imported(snapshot.data.equipment))
        updatedRecords += updateExisting(database, 'Equipment', row.externalId, {
          DiverID: row.diverId ? externalById.get(row.diverId) : null,
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
          Inactive: row.inactive ? 1 : 0,
          Weight: row.weightKg,
          TypeID: row.equipmentTypeCode,
          Val1: row.sourceValue1,
          Val2: row.sourceValue2,
          Val3: row.sourceValue3,
          Comments: row.notes,
        })
      for (const row of imported(snapshot.data.dives))
        updatedRecords += updateExisting(database, 'Logbook', row.externalId, {
          DiverID: row.diverId ? externalById.get(row.diverId) : null,
          PlaceID: row.siteId ? externalById.get(row.siteId) : null,
          ShopID: row.shopId ? externalById.get(row.shopId) : null,
          TypeOfDive: row.diveTypeId ? externalById.get(row.diveTypeId) : null,
          BuddyIDs: (buddyIdsByDive.get(row.id) ?? []).join(','),
          UsedEquip: (equipmentIdsByDive.get(row.id) ?? []).join(','),
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
          Deco: row.decompressionDive ? 1 : 0,
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
          Buddy: row.legacyBuddyText,
          Comments: row.notes,
        })
      for (const row of imported(snapshot.data.tanks))
        updatedRecords += updateExisting(database, 'Tank', row.externalId, {
          LogID: externalById.get(row.diveId),
          Name: row.name,
          SortOrd: row.sortOrder,
          TankID: row.computerTankNumber,
          Tanktype: row.tankType,
          Tanksize: row.volumeLiters,
          PresS: row.startPressureBar,
          PresE: row.endPressureBar,
          PresW: row.workingPressureBar,
          O2: row.oxygenPercent,
          He: row.heliumPercent,
          BreathingTime: row.breathingTimeSeconds,
          SupplyType: row.supplyTypeCode,
          Weight: row.weightKg,
          DivePhase: row.divePhaseCode,
        })
      for (const row of imported(snapshot.data.pictures))
        updatedRecords += updateExisting(database, 'Pictures', row.externalId, {
          LogID: row.diveId ? externalById.get(row.diveId) : null,
          PlaceID: row.siteId ? externalById.get(row.siteId) : null,
          BuddyID: row.buddyId ? externalById.get(row.buddyId) : null,
          EquipmentID: row.equipmentId ? externalById.get(row.equipmentId) : null,
          DiverID: row.diverId ? externalById.get(row.diverId) : null,
          Path: row.path,
          Description: row.description,
          SortOrd: row.sortOrder,
        })
    })()
    database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    database.close()
    const bytes = new Uint8Array(await readFile(path))
    setStage('uploading-drive')
    await drive.replaceDatabase(bytes)
    return { updatedRecords, skippedLocalRecords, driveFileId: drive.databaseFile.id }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export function startDiveMateWriteBack(): DiveMateWriteBackStatus {
  const current = writeBackState.__divetracxWriteBack
  if (current?.state === 'running') return current
  const status: DiveMateWriteBackStatus = {
    id: randomUUID(),
    state: 'running',
    stage: 'reading-drive',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    result: null,
    error: null,
  }
  writeBackState.__divetracxWriteBack = status
  void writeBackDiveMate().then(
    (result) => {
      status.state = 'succeeded'
      status.result = result
      status.finishedAt = new Date().toISOString()
    },
    (error) => {
      status.state = 'failed'
      status.error = error instanceof Error ? error.message : 'Drive write-back failed'
      status.finishedAt = new Date().toISOString()
    },
  )
  return status
}

export function getDiveMateWriteBackStatus(): DiveMateWriteBackStatus | null {
  return writeBackState.__divetracxWriteBack ?? null
}
