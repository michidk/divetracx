import '@tanstack/react-start/server-only'

import { eq } from 'drizzle-orm'
import { z } from 'zod'
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
  shops,
  tanks,
} from '@/db/schema'
import type { EditorValues, EntityKey } from '../entities'

const uuidSchema = z.string().uuid()

function fieldValue(values: EditorValues, key: string) {
  return values[key]
}

function optionalText(values: EditorValues, key: string) {
  const value = fieldValue(values, key)
  if (value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error(`${key} must be text`)
  return value
}

function requiredText(values: EditorValues, key: string) {
  const value = optionalText(values, key)
  if (!value?.trim()) throw new Error(`${key} is required`)
  return value
}

function optionalInteger(
  values: EditorValues,
  key: string,
  limits: { min?: number; max?: number } = {},
) {
  const value = optionalText(values, key)
  if (value === null) return null
  if (!/^-?\d+$/.test(value)) throw new Error(`${key} must be a whole number`)
  const parsed = Number(value)
  if (limits.min !== undefined && parsed < limits.min) {
    throw new Error(`${key} must be at least ${limits.min}`)
  }
  if (limits.max !== undefined && parsed > limits.max) {
    throw new Error(`${key} must be at most ${limits.max}`)
  }
  return parsed
}

function requiredInteger(
  values: EditorValues,
  key: string,
  limits: { min?: number; max?: number } = {},
) {
  const value = optionalInteger(values, key, limits)
  if (value === null) throw new Error(`${key} is required`)
  return value
}

function optionalDecimal(
  values: EditorValues,
  key: string,
  limits: { min?: number; max?: number } = {},
) {
  const value = optionalText(values, key)
  if (value === null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${key} must be a number`)
  if (limits.min !== undefined && parsed < limits.min) {
    throw new Error(`${key} must be at least ${limits.min}`)
  }
  if (limits.max !== undefined && parsed > limits.max) {
    throw new Error(`${key} must be at most ${limits.max}`)
  }
  return value
}

function optionalUuid(values: EditorValues, key: string) {
  const value = optionalText(values, key)
  if (value === null) return null
  const parsed = uuidSchema.safeParse(value)
  if (!parsed.success) throw new Error(`${key} is invalid`)
  return parsed.data
}

function requiredUuid(values: EditorValues, key: string) {
  const value = optionalUuid(values, key)
  if (!value) throw new Error(`${key} is required`)
  return value
}

function booleanValue(values: EditorValues, key: string) {
  const value = fieldValue(values, key)
  if (value === undefined || value === '') return false
  if (typeof value !== 'boolean') throw new Error(`${key} must be true or false`)
  return value
}

function uuidList(values: EditorValues, key: string) {
  const value = fieldValue(values, key)
  if (value === undefined || value === '') return []
  if (!Array.isArray(value)) throw new Error(`${key} must be a list`)
  return Array.from(new Set(value.map((item) => uuidSchema.parse(item))))
}

function recordId(value: string) {
  const parsed = uuidSchema.safeParse(value)
  if (!parsed.success) throw new Error('Record ID is invalid')
  return parsed.data
}

async function saveDive(id: string, values: EditorValues) {
  const maximumDepthMeters = optionalDecimal(values, 'maximumDepthMeters', { min: 0 })
  const averageDepthMeters = optionalDecimal(values, 'averageDepthMeters', { min: 0 })
  if (
    maximumDepthMeters !== null &&
    averageDepthMeters !== null &&
    Number(averageDepthMeters) > Number(maximumDepthMeters)
  ) {
    throw new Error('Average depth cannot exceed maximum depth')
  }

  const fields = {
    diverId: optionalUuid(values, 'diverId'),
    siteId: optionalUuid(values, 'siteId'),
    shopId: optionalUuid(values, 'shopId'),
    diveTypeId: optionalUuid(values, 'diveTypeId'),
    number: optionalInteger(values, 'number', { min: 1 }),
    diveDate: requiredText(values, 'diveDate'),
    entryTime: optionalText(values, 'entryTime'),
    utcOffsetMinutes: optionalInteger(values, 'utcOffsetMinutes'),
    durationSeconds: requiredInteger(values, 'durationSeconds', { min: 0 }),
    surfaceIntervalSeconds: optionalInteger(values, 'surfaceIntervalSeconds', {
      min: 0,
    }),
    maximumDepthMeters,
    averageDepthMeters,
    airTemperatureCelsius: optionalDecimal(values, 'airTemperatureCelsius'),
    waterTemperatureCelsius: optionalDecimal(values, 'waterTemperatureCelsius'),
    weightKg: optionalDecimal(values, 'weightKg', { min: 0 }),
    visibility: optionalText(values, 'visibility'),
    current: optionalText(values, 'current'),
    waves: optionalText(values, 'waves'),
    weather: optionalText(values, 'weather'),
    waterType: optionalInteger(values, 'waterType'),
    entryType: optionalInteger(values, 'entryType'),
    rating: optionalInteger(values, 'rating', { min: 1, max: 5 }),
    computer: optionalText(values, 'computer'),
    suit: optionalText(values, 'suit'),
    boat: optionalText(values, 'boat'),
    divemaster: optionalText(values, 'divemaster'),
    notes: optionalText(values, 'notes'),
    updatedAt: new Date(),
  }
  const buddyIds = uuidList(values, 'buddyIds')
  const equipmentIds = uuidList(values, 'equipmentIds')

  return getDb().transaction(async (transaction) => {
    const [row] =
      id === 'new'
        ? await transaction
            .insert(dives)
            .values({ ...fields, sourceKey: 'manual' })
            .returning({ id: dives.id, sourceKey: dives.sourceKey })
        : await transaction
            .update(dives)
            .set(fields)
            .where(eq(dives.id, recordId(id)))
            .returning({ id: dives.id, sourceKey: dives.sourceKey })
    if (!row) throw new Error('Dive was not found')

    await transaction.delete(diveBuddies).where(eq(diveBuddies.diveId, row.id))
    if (buddyIds.length > 0) {
      await transaction.insert(diveBuddies).values(
        buddyIds.map((buddyId) => ({
          diveId: row.id,
          buddyId,
          sourceKey: row.sourceKey,
        })),
      )
    }

    await transaction.delete(diveEquipment).where(eq(diveEquipment.diveId, row.id))
    if (equipmentIds.length > 0) {
      await transaction.insert(diveEquipment).values(
        equipmentIds.map((equipmentId) => ({
          diveId: row.id,
          equipmentId,
          sourceKey: row.sourceKey,
        })),
      )
    }
    return row.id
  })
}

async function saveSite(id: string, values: EditorValues) {
  const fields = {
    name: requiredText(values, 'name'),
    country: optionalText(values, 'country'),
    region: optionalText(values, 'region'),
    waterName: optionalText(values, 'waterName'),
    latitude: optionalDecimal(values, 'latitude', { min: -90, max: 90 }),
    longitude: optionalDecimal(values, 'longitude', { min: -180, max: 180 }),
    maximumDepthMeters: optionalDecimal(values, 'maximumDepthMeters', { min: 0 }),
    altitudeMeters: optionalInteger(values, 'altitudeMeters'),
    difficulty: optionalText(values, 'difficulty'),
    rating: optionalInteger(values, 'rating', { min: 1, max: 5 }),
    waterType: optionalInteger(values, 'waterType'),
    notes: optionalText(values, 'notes'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(diveSites)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: diveSites.id })
      : await getDb()
          .update(diveSites)
          .set(fields)
          .where(eq(diveSites.id, recordId(id)))
          .returning({ id: diveSites.id })
  if (!row) throw new Error('Dive site was not found')
  return row.id
}

async function saveDiver(id: string, values: EditorValues) {
  const fields = {
    firstName: optionalText(values, 'firstName'),
    lastName: optionalText(values, 'lastName'),
    email: optionalText(values, 'email'),
    phone: optionalText(values, 'phone'),
    birthDate: optionalText(values, 'birthDate'),
    bloodGroup: optionalText(values, 'bloodGroup'),
    emergencyContact: optionalText(values, 'emergencyContact'),
    emergencyPhone: optionalText(values, 'emergencyPhone'),
    insurance: optionalText(values, 'insurance'),
    notes: optionalText(values, 'notes'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(divers)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: divers.id })
      : await getDb()
          .update(divers)
          .set(fields)
          .where(eq(divers.id, recordId(id)))
          .returning({ id: divers.id })
  if (!row) throw new Error('Diver was not found')
  return row.id
}

async function saveBuddy(id: string, values: EditorValues) {
  const fields = {
    firstName: optionalText(values, 'firstName'),
    lastName: optionalText(values, 'lastName'),
    email: optionalText(values, 'email'),
    phone: optionalText(values, 'phone'),
    city: optionalText(values, 'city'),
    country: optionalText(values, 'country'),
    notes: optionalText(values, 'notes'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(buddies)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: buddies.id })
      : await getDb()
          .update(buddies)
          .set(fields)
          .where(eq(buddies.id, recordId(id)))
          .returning({ id: buddies.id })
  if (!row) throw new Error('Buddy was not found')
  return row.id
}

async function saveEquipment(id: string, values: EditorValues) {
  const fields = {
    name: requiredText(values, 'name'),
    category: optionalText(values, 'category'),
    manufacturer: optionalText(values, 'manufacturer'),
    model: optionalText(values, 'model'),
    serialNumber: optionalText(values, 'serialNumber'),
    purchasedAt: optionalText(values, 'purchasedAt'),
    retiredAt: optionalText(values, 'retiredAt'),
    serviceDueAt: optionalText(values, 'serviceDueAt'),
    inactive: booleanValue(values, 'inactive'),
    weightKg: optionalDecimal(values, 'weightKg', { min: 0 }),
    notes: optionalText(values, 'notes'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(equipment)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: equipment.id })
      : await getDb()
          .update(equipment)
          .set(fields)
          .where(eq(equipment.id, recordId(id)))
          .returning({ id: equipment.id })
  if (!row) throw new Error('Equipment item was not found')
  return row.id
}

async function saveCertification(id: string, values: EditorValues) {
  const fields = {
    diverId: optionalUuid(values, 'diverId'),
    name: requiredText(values, 'name'),
    organization: optionalText(values, 'organization'),
    certificationNumber: optionalText(values, 'certificationNumber'),
    certifiedAt: optionalText(values, 'certifiedAt'),
    instructorName: optionalText(values, 'instructorName'),
    instructorNumber: optionalText(values, 'instructorNumber'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(certifications)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: certifications.id })
      : await getDb()
          .update(certifications)
          .set(fields)
          .where(eq(certifications.id, recordId(id)))
          .returning({ id: certifications.id })
  if (!row) throw new Error('Certification was not found')
  return row.id
}

async function saveShop(id: string, values: EditorValues) {
  const fields = { name: requiredText(values, 'name'), updatedAt: new Date() }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(shops)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: shops.id })
      : await getDb()
          .update(shops)
          .set(fields)
          .where(eq(shops.id, recordId(id)))
          .returning({ id: shops.id })
  if (!row) throw new Error('Dive shop was not found')
  return row.id
}

async function saveDiveType(id: string, values: EditorValues) {
  const fields = {
    name: requiredText(values, 'name'),
    sortOrder: optionalInteger(values, 'sortOrder'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(diveTypes)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: diveTypes.id })
      : await getDb()
          .update(diveTypes)
          .set(fields)
          .where(eq(diveTypes.id, recordId(id)))
          .returning({ id: diveTypes.id })
  if (!row) throw new Error('Dive type was not found')
  return row.id
}

async function saveTank(id: string, values: EditorValues) {
  const startPressureBar = optionalDecimal(values, 'startPressureBar', { min: 0 })
  const endPressureBar = optionalDecimal(values, 'endPressureBar', { min: 0 })
  if (
    startPressureBar !== null &&
    endPressureBar !== null &&
    Number(endPressureBar) > Number(startPressureBar)
  ) {
    throw new Error('End pressure cannot exceed start pressure')
  }
  const oxygenPercent = optionalDecimal(values, 'oxygenPercent', { min: 0, max: 100 })
  const heliumPercent = optionalDecimal(values, 'heliumPercent', { min: 0, max: 100 })
  if (Number(oxygenPercent ?? 0) + Number(heliumPercent ?? 0) > 100) {
    throw new Error('Oxygen and helium percentages cannot exceed 100%')
  }

  const fields = {
    diveId: requiredUuid(values, 'diveId'),
    name: optionalText(values, 'name'),
    sortOrder: optionalInteger(values, 'sortOrder'),
    computerTankNumber: optionalInteger(values, 'computerTankNumber', { min: 1 }),
    tankType: optionalInteger(values, 'tankType'),
    volumeLiters: optionalDecimal(values, 'volumeLiters', { min: 0 }),
    startPressureBar,
    endPressureBar,
    oxygenPercent,
    heliumPercent,
    breathingTimeSeconds: optionalInteger(values, 'breathingTimeSeconds', { min: 0 }),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(tanks)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: tanks.id })
      : await getDb()
          .update(tanks)
          .set(fields)
          .where(eq(tanks.id, recordId(id)))
          .returning({ id: tanks.id })
  if (!row) throw new Error('Tank was not found')
  return row.id
}

async function saveProfileSample(id: string, values: EditorValues) {
  const depthMeters = optionalDecimal(values, 'depthMeters', { min: 0 })
  if (depthMeters === null) throw new Error('depthMeters is required')
  const fields = {
    diveId: requiredUuid(values, 'diveId'),
    sampleIndex: requiredInteger(values, 'sampleIndex', { min: 0 }),
    elapsedSeconds: requiredInteger(values, 'elapsedSeconds', { min: 0 }),
    depthMeters,
    temperatureCelsius: optionalDecimal(values, 'temperatureCelsius'),
    pressureBar: optionalDecimal(values, 'pressureBar', { min: 0 }),
    tank1PressureBar: optionalDecimal(values, 'tank1PressureBar', { min: 0 }),
    tank2PressureBar: optionalDecimal(values, 'tank2PressureBar', { min: 0 }),
    decoCeilingMeters: optionalDecimal(values, 'decoCeilingMeters', { min: 0 }),
    tankNumber: optionalInteger(values, 'tankNumber', { min: 1 }),
    updatedAt: new Date(),
  }

  const [row] =
    id === 'new'
      ? await getDb()
          .insert(diveProfileSamples)
          .values({ ...fields, sourceKey: 'manual' })
          .returning({ id: diveProfileSamples.id })
      : await getDb()
          .update(diveProfileSamples)
          .set(fields)
          .where(eq(diveProfileSamples.id, recordId(id)))
          .returning({ id: diveProfileSamples.id })
  if (!row) throw new Error('Profile sample was not found')
  return row.id
}

export async function saveDataRecord(
  entity: EntityKey,
  id: string,
  values: EditorValues,
) {
  switch (entity) {
    case 'dives':
      return saveDive(id, values)
    case 'sites':
      return saveSite(id, values)
    case 'divers':
      return saveDiver(id, values)
    case 'buddies':
      return saveBuddy(id, values)
    case 'equipment':
      return saveEquipment(id, values)
    case 'certifications':
      return saveCertification(id, values)
    case 'shops':
      return saveShop(id, values)
    case 'dive-types':
      return saveDiveType(id, values)
    case 'tanks':
      return saveTank(id, values)
    case 'profile-samples':
      return saveProfileSample(id, values)
    case 'sync-runs':
      throw new Error('Synchronization history is read-only')
  }
}
