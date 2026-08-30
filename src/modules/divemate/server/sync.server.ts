import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  buddies,
  certifications,
  diveBuddies,
  diveEquipment,
  diveProfileSamples,
  divers,
  diveSites,
  dives,
  diveTypes,
  equipment,
  pictures,
  shops,
  syncRuns,
  tanks,
} from '@/db/schema'
import { getServerEnv } from '@/env'
import { parseDiveMateDatabase } from '../parser'
import type { DiveMateSnapshot, DiveMateSourceRecord } from '../types'

const SOURCE_KEY = 'divemate'

export interface DiveMateSyncResult {
  runId: string
  fingerprint: string
  databaseVersion: string | null
  counts: Record<string, number>
}

export type DiveMateSyncTrigger = 'manual' | 'schedule' | 'cli'

export interface DiveMateSyncOptions {
  trigger?: DiveMateSyncTrigger
}

function directDownloadUrl(configuredUrl: string): string {
  const match = configuredUrl.match(/\/file\/d\/([A-Za-z0-9_-]+)/)
  if (match?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`
  }
  return configuredUrl
}

async function downloadBackup(url: string, maximumBytes: number) {
  const response = await fetch(directDownloadUrl(url), {
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) {
    throw new Error(`DiveMate backup download failed with HTTP ${response.status}`)
  }

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error(`DiveMate backup exceeds the ${maximumBytes} byte limit`)
  }
  if (!response.body) throw new Error('DiveMate backup response had no body')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > maximumBytes) {
      await reader.cancel()
      throw new Error(`DiveMate backup exceeds the ${maximumBytes} byte limit`)
    }
    chunks.push(value)
  }

  const backup = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    backup.set(chunk, offset)
    offset += chunk.byteLength
  }
  if (new TextDecoder().decode(backup.slice(0, 16)) !== 'SQLite format 3\0') {
    throw new Error('The downloaded file is not a SQLite 3 database')
  }
  return backup
}

function sourceValues(record: DiveMateSourceRecord) {
  return {
    sourceKey: SOURCE_KEY,
    externalId: record.externalId,
    externalUuid: record.externalUuid,
    sourceUpdatedAt: record.sourceUpdatedAt,
    sourcePayload: record.sourcePayload,
    updatedAt: new Date(),
  }
}

async function importSnapshot(snapshot: DiveMateSnapshot) {
  const db = getDb()
  return db.transaction(async (tx) => {
    const diverIds = new Map<string, string>()
    for (const item of snapshot.divers) {
      const [row] = await tx
        .insert(divers)
        .values({
          ...sourceValues(item),
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          phone: item.phone,
          street: item.street,
          postalCode: item.postalCode,
          city: item.city,
          state: item.state,
          country: item.country,
          birthDate: item.birthDate,
          bloodGroup: item.bloodGroup,
          emergencyContact: item.emergencyContact,
          emergencyPhone: item.emergencyPhone,
          emergencyEmail: item.emergencyEmail,
          insurance: item.insurance,
          notes: item.notes,
        })
        .onConflictDoUpdate({
          target: [divers.sourceKey, divers.externalId],
          set: {
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            phone: item.phone,
            street: item.street,
            postalCode: item.postalCode,
            city: item.city,
            state: item.state,
            country: item.country,
            birthDate: item.birthDate,
            bloodGroup: item.bloodGroup,
            emergencyContact: item.emergencyContact,
            emergencyPhone: item.emergencyPhone,
            emergencyEmail: item.emergencyEmail,
            insurance: item.insurance,
            notes: item.notes,
            externalUuid: item.externalUuid,
            sourceUpdatedAt: item.sourceUpdatedAt,
            sourcePayload: item.sourcePayload,
            updatedAt: new Date(),
          },
        })
        .returning({ id: divers.id })
      if (row) diverIds.set(item.externalId, row.id)
    }

    const siteIds = new Map<string, string>()
    for (const item of snapshot.sites) {
      const values = {
        ...sourceValues(item),
        name: item.name,
        country: item.country,
        region: item.region,
        waterName: item.waterName,
        latitude: item.latitude,
        longitude: item.longitude,
        sourceLatitude: item.sourceLatitude,
        sourceLongitude: item.sourceLongitude,
        maximumDepthMeters: item.maximumDepthMeters,
        altitudeMeters: item.altitudeMeters,
        difficulty: item.difficulty,
        rating: item.rating,
        waterType: item.waterType,
        notes: item.notes,
      }
      const [row] = await tx
        .insert(diveSites)
        .values(values)
        .onConflictDoUpdate({
          target: [diveSites.sourceKey, diveSites.externalId],
          set: values,
        })
        .returning({ id: diveSites.id })
      if (row) siteIds.set(item.externalId, row.id)
    }

    const buddyIds = new Map<string, string>()
    for (const item of snapshot.buddies) {
      const values = {
        ...sourceValues(item),
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        phone: item.phone,
        street: item.street,
        postalCode: item.postalCode,
        city: item.city,
        state: item.state,
        country: item.country,
        notes: item.notes,
      }
      const [row] = await tx
        .insert(buddies)
        .values(values)
        .onConflictDoUpdate({
          target: [buddies.sourceKey, buddies.externalId],
          set: values,
        })
        .returning({ id: buddies.id })
      if (row) buddyIds.set(item.externalId, row.id)
    }

    const equipmentIds = new Map<string, string>()
    for (const item of snapshot.equipment) {
      const values = {
        ...sourceValues(item),
        diverId: item.diverExternalId
          ? (diverIds.get(item.diverExternalId) ?? null)
          : null,
        name: item.name,
        category: item.category,
        manufacturer: item.manufacturer,
        model: item.model,
        serialNumber: item.serialNumber,
        information: item.information,
        purchasedAt: item.purchasedAt,
        purchasePrice: item.purchasePrice,
        purchaseShop: item.purchaseShop,
        retiredAt: item.retiredAt,
        serviceDueAt: item.serviceDueAt,
        inactive: item.inactive,
        weightKg: item.weightKg,
        equipmentTypeCode: item.equipmentTypeCode,
        sourceValue1: item.sourceValue1,
        sourceValue2: item.sourceValue2,
        sourceValue3: item.sourceValue3,
        notes: item.notes,
      }
      const [row] = await tx
        .insert(equipment)
        .values(values)
        .onConflictDoUpdate({
          target: [equipment.sourceKey, equipment.externalId],
          set: values,
        })
        .returning({ id: equipment.id })
      if (row) equipmentIds.set(item.externalId, row.id)
    }

    const shopIds = new Map<string, string>()
    for (const item of snapshot.shops) {
      const values = { ...sourceValues(item), name: item.name }
      const [row] = await tx
        .insert(shops)
        .values(values)
        .onConflictDoUpdate({
          target: [shops.sourceKey, shops.externalId],
          set: values,
        })
        .returning({ id: shops.id })
      if (row) shopIds.set(item.externalId, row.id)
    }

    const diveTypeIds = new Map<string, string>()
    for (const item of snapshot.diveTypes) {
      const values = {
        ...sourceValues(item),
        name: item.name,
        sortOrder: item.sortOrder,
      }
      const [row] = await tx
        .insert(diveTypes)
        .values(values)
        .onConflictDoUpdate({
          target: [diveTypes.sourceKey, diveTypes.externalId],
          set: values,
        })
        .returning({ id: diveTypes.id })
      if (row) diveTypeIds.set(item.externalId, row.id)
    }

    for (const item of snapshot.certifications) {
      const values = {
        ...sourceValues(item),
        diverId: item.diverExternalId
          ? (diverIds.get(item.diverExternalId) ?? null)
          : null,
        name: item.name,
        organization: item.organization,
        certificationNumber: item.certificationNumber,
        certifiedAt: item.certifiedAt,
        instructorName: item.instructorName,
        instructorNumber: item.instructorNumber,
        sortOrder: item.sortOrder,
        scan1Path: item.scan1Path,
        scan2Path: item.scan2Path,
      }
      await tx
        .insert(certifications)
        .values(values)
        .onConflictDoUpdate({
          target: [certifications.sourceKey, certifications.externalId],
          set: values,
        })
    }

    const diveIds = new Map<string, string>()
    const profileSamplesByDive = new Map<string, DiveMateSnapshot['profileSamples']>()
    for (const sample of snapshot.profileSamples) {
      const samples = profileSamplesByDive.get(sample.diveExternalId) ?? []
      samples.push(sample)
      profileSamplesByDive.set(sample.diveExternalId, samples)
    }

    for (const item of snapshot.dives) {
      const values = {
        ...sourceValues(item),
        diverId: item.diverExternalId
          ? (diverIds.get(item.diverExternalId) ?? null)
          : null,
        siteId: item.siteExternalId ? (siteIds.get(item.siteExternalId) ?? null) : null,
        shopId: item.shopExternalId ? (shopIds.get(item.shopExternalId) ?? null) : null,
        diveTypeId: item.diveTypeExternalId
          ? (diveTypeIds.get(item.diveTypeExternalId) ?? null)
          : null,
        number: item.number,
        diveDate: item.diveDate,
        entryTime: item.entryTime,
        utcOffsetMinutes: item.utcOffsetMinutes,
        durationSeconds: item.durationSeconds,
        surfaceIntervalSeconds: item.surfaceIntervalSeconds,
        maximumDepthMeters: item.maximumDepthMeters,
        averageDepthMeters: item.averageDepthMeters,
        airTemperatureCelsius: item.airTemperatureCelsius,
        waterTemperatureCelsius: item.waterTemperatureCelsius,
        weightKg: item.weightKg,
        equipmentWeightKg: item.equipmentWeightKg,
        maximumPpo2: item.maximumPpo2,
        decompressionDive: item.decompressionDive,
        visibility: item.visibility,
        current: item.current,
        waves: item.waves,
        weather: item.weather,
        waterType: item.waterType,
        entryType: item.entryType,
        rating: item.rating,
        computer: item.computer,
        suit: item.suit,
        boat: item.boat,
        divemaster: item.divemaster,
        legacyBuddyText: item.legacyBuddyText,
        notes: item.notes,
      }
      const [row] = await tx
        .insert(dives)
        .values(values)
        .onConflictDoUpdate({
          target: [dives.sourceKey, dives.externalId],
          set: values,
        })
        .returning({ id: dives.id })
      if (!row) continue
      diveIds.set(item.externalId, row.id)

      await tx
        .delete(diveBuddies)
        .where(and(eq(diveBuddies.diveId, row.id), eq(diveBuddies.sourceKey, SOURCE_KEY)))
      const importedBuddyIds = item.buddyExternalIds
        .map((id) => buddyIds.get(id))
        .filter((id): id is string => Boolean(id))
      if (importedBuddyIds.length > 0) {
        await tx.insert(diveBuddies).values(
          importedBuddyIds.map((buddyId) => ({
            diveId: row.id,
            buddyId,
            sourceKey: SOURCE_KEY,
          })),
        )
      }

      await tx
        .delete(diveEquipment)
        .where(
          and(eq(diveEquipment.diveId, row.id), eq(diveEquipment.sourceKey, SOURCE_KEY)),
        )
      const importedEquipmentIds = item.equipmentExternalIds
        .map((id) => equipmentIds.get(id))
        .filter((id): id is string => Boolean(id))
      if (importedEquipmentIds.length > 0) {
        await tx.insert(diveEquipment).values(
          importedEquipmentIds.map((equipmentId) => ({
            diveId: row.id,
            equipmentId,
            sourceKey: SOURCE_KEY,
          })),
        )
      }

      await tx
        .delete(diveProfileSamples)
        .where(
          and(
            eq(diveProfileSamples.diveId, row.id),
            eq(diveProfileSamples.sourceKey, SOURCE_KEY),
          ),
        )
      const importedProfileSamples = profileSamplesByDive.get(item.externalId) ?? []
      if (importedProfileSamples.length > 0) {
        await tx.insert(diveProfileSamples).values(
          importedProfileSamples.map((sample) => ({
            ...sourceValues(sample),
            diveId: row.id,
            sampleIndex: sample.sampleIndex,
            elapsedSeconds: sample.elapsedSeconds,
            depthMeters: sample.depthMeters,
            temperatureCelsius: sample.temperatureCelsius,
            pressureBar: sample.pressureBar,
            tank1PressureBar: sample.tank1PressureBar,
            tank2PressureBar: sample.tank2PressureBar,
            decoCeilingMeters: sample.decoCeilingMeters,
            tankNumber: sample.tankNumber,
          })),
        )
      }
    }

    for (const item of snapshot.tanks) {
      const diveId = diveIds.get(item.diveExternalId)
      if (!diveId) continue
      const values = {
        ...sourceValues(item),
        diveId,
        name: item.name,
        sortOrder: item.sortOrder,
        computerTankNumber: item.computerTankNumber,
        tankType: item.tankType,
        volumeLiters: item.volumeLiters,
        startPressureBar: item.startPressureBar,
        endPressureBar: item.endPressureBar,
        workingPressureBar: item.workingPressureBar,
        oxygenPercent: item.oxygenPercent,
        heliumPercent: item.heliumPercent,
        breathingTimeSeconds: item.breathingTimeSeconds,
        supplyTypeCode: item.supplyTypeCode,
        weightKg: item.weightKg,
        divePhaseCode: item.divePhaseCode,
      }
      await tx
        .insert(tanks)
        .values(values)
        .onConflictDoUpdate({
          target: [tanks.sourceKey, tanks.externalId],
          set: values,
        })
    }

    for (const item of snapshot.pictures) {
      const values = {
        ...sourceValues(item),
        diveId: item.diveExternalId ? (diveIds.get(item.diveExternalId) ?? null) : null,
        siteId: item.siteExternalId ? (siteIds.get(item.siteExternalId) ?? null) : null,
        buddyId: item.buddyExternalId
          ? (buddyIds.get(item.buddyExternalId) ?? null)
          : null,
        equipmentId: item.equipmentExternalId
          ? (equipmentIds.get(item.equipmentExternalId) ?? null)
          : null,
        diverId: item.diverExternalId
          ? (diverIds.get(item.diverExternalId) ?? null)
          : null,
        path: item.path,
        description: item.description,
        sortOrder: item.sortOrder,
      }
      await tx
        .insert(pictures)
        .values(values)
        .onConflictDoUpdate({
          target: [pictures.sourceKey, pictures.externalId],
          set: values,
        })
    }

    return {
      divers: snapshot.divers.length,
      sites: snapshot.sites.length,
      buddies: snapshot.buddies.length,
      equipment: snapshot.equipment.length,
      certifications: snapshot.certifications.length,
      shops: snapshot.shops.length,
      diveTypes: snapshot.diveTypes.length,
      dives: snapshot.dives.length,
      tanks: snapshot.tanks.length,
      pictures: snapshot.pictures.length,
      profileSamples: snapshot.profileSamples.length,
    }
  })
}

export async function syncDiveMate(
  options: DiveMateSyncOptions = {},
): Promise<DiveMateSyncResult> {
  const environment = getServerEnv()
  if (!environment.DIVEMATE_BACKUP_URL) {
    throw new Error('DIVEMATE_BACKUP_URL is not configured')
  }

  const db = getDb()
  const [run] = await db
    .insert(syncRuns)
    .values({ sourceKey: SOURCE_KEY, trigger: options.trigger ?? 'cli' })
    .returning({ id: syncRuns.id })
  if (!run) throw new Error('Could not create the DiveMate sync run')

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'divetracx-divemate-'))
  const databasePath = join(temporaryDirectory, 'DiveMate.ddb')
  try {
    const backup = await downloadBackup(
      environment.DIVEMATE_BACKUP_URL,
      environment.DIVEMATE_MAX_BACKUP_BYTES,
    )
    const fingerprint = createHash('sha256').update(backup).digest('hex')
    await writeFile(databasePath, backup)
    const snapshot = parseDiveMateDatabase(databasePath)
    const counts = await importSnapshot(snapshot)

    await db
      .update(syncRuns)
      .set({
        status: 'succeeded',
        finishedAt: new Date(),
        sourceFingerprint: fingerprint,
        sourceDatabaseVersion: snapshot.databaseVersion,
        sourceDatabaseProgram: snapshot.databaseProgram,
        sourceDatabaseUuid: snapshot.databaseUuid,
        sourceDatabaseUpdatedAt: snapshot.databaseUpdatedAt,
        counts,
      })
      .where(eq(syncRuns.id, run.id))

    return {
      runId: run.id,
      fingerprint,
      databaseVersion: snapshot.databaseVersion,
      counts,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error'
    await db
      .update(syncRuns)
      .set({ status: 'failed', finishedAt: new Date(), error: message })
      .where(eq(syncRuns.id, run.id))
      .catch(() => undefined)
    throw error
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}
