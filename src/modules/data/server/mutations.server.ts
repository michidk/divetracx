import '@tanstack/react-start/server-only'

import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import {
  agencyMemberships,
  buddies,
  certifications,
  divers,
  diveSites,
  equipment,
  externalRecordLinks,
} from '@/db/schema'
import { getStorage } from '@/lib/storage'
import { findAgency } from '@/modules/profile/agency-catalog'
import type { EditorValues, EntityKey } from '../entities'

const uuidSchema = z.string().uuid()

function optionalText(values: EditorValues, key: string) {
  const value = values[key]
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

function booleanValue(values: EditorValues, key: string) {
  const value = values[key]
  if (value === undefined || value === '') return false
  if (typeof value !== 'boolean') throw new Error(`${key} must be true or false`)
  return value
}

function recordId(value: string) {
  const parsed = uuidSchema.safeParse(value)
  if (!parsed.success) throw new Error('Record ID is invalid')
  return parsed.data
}

function optionalRecordId(values: EditorValues, key: string) {
  const value = optionalText(values, key)
  if (value === null) return null
  const parsed = uuidSchema.safeParse(value)
  if (!parsed.success) throw new Error(`${key} must reference an existing record`)
  return parsed.data
}

/** Personal logbook records belong to the primary diver. */
async function primaryDiverId() {
  const [diver] = await getDb()
    .select({ id: divers.id })
    .from(divers)
    .orderBy(asc(divers.createdAt))
    .limit(1)
  return diver?.id ?? null
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
    waterType: optionalInteger(values, 'waterType', { min: 0 }),
    notes: optionalText(values, 'notes'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb().insert(diveSites).values(fields).returning({ id: diveSites.id })
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
    street: optionalText(values, 'street'),
    postalCode: optionalText(values, 'postalCode'),
    city: optionalText(values, 'city'),
    state: optionalText(values, 'state'),
    country: optionalText(values, 'country'),
    birthDate: optionalText(values, 'birthDate'),
    bloodGroup: optionalText(values, 'bloodGroup'),
    emergencyContact: optionalText(values, 'emergencyContact'),
    emergencyPhone: optionalText(values, 'emergencyPhone'),
    emergencyEmail: optionalText(values, 'emergencyEmail'),
    insurance: optionalText(values, 'insurance'),
    insuranceTariff: optionalText(values, 'insuranceTariff'),
    insuranceNumber: optionalText(values, 'insuranceNumber'),
    insuranceHotline: optionalText(values, 'insuranceHotline'),
    notes: optionalText(values, 'notes'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb().insert(divers).values(fields).returning({ id: divers.id })
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
    street: optionalText(values, 'street'),
    postalCode: optionalText(values, 'postalCode'),
    city: optionalText(values, 'city'),
    state: optionalText(values, 'state'),
    country: optionalText(values, 'country'),
    notes: optionalText(values, 'notes'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb().insert(buddies).values(fields).returning({ id: buddies.id })
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
    information: optionalText(values, 'information'),
    purchasedAt: optionalText(values, 'purchasedAt'),
    purchasePrice: optionalDecimal(values, 'purchasePrice', { min: 0 }),
    purchaseShop: optionalText(values, 'purchaseShop'),
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
          .values({ ...fields, diverId: await primaryDiverId() })
          .returning({ id: equipment.id })
      : await getDb()
          .update(equipment)
          .set(fields)
          .where(eq(equipment.id, recordId(id)))
          .returning({ id: equipment.id })
  if (!row) throw new Error('Gear item was not found')
  return row.id
}

async function saveCertification(id: string, values: EditorValues) {
  const fields = {
    name: requiredText(values, 'name'),
    organization: optionalText(values, 'organization'),
    certificationNumber: optionalText(values, 'certificationNumber'),
    certifiedAt: optionalText(values, 'certifiedAt'),
    instructorBuddyId: optionalRecordId(values, 'instructorBuddyId'),
    instructorNumber: optionalText(values, 'instructorNumber'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(certifications)
          .values({ ...fields, diverId: await primaryDiverId() })
          .returning({ id: certifications.id })
      : await getDb()
          .update(certifications)
          .set(fields)
          .where(eq(certifications.id, recordId(id)))
          .returning({ id: certifications.id })
  if (!row) throw new Error('Certification was not found')
  return row.id
}

async function saveAgencyMembership(id: string, values: EditorValues) {
  const agencyCode = requiredText(values, 'agencyCode')
  const isCustom = agencyCode === 'custom'
  if (!isCustom && !findAgency(agencyCode)) {
    throw new Error('Select a supported agency or choose Custom agency')
  }

  const customAgencyName = isCustom ? requiredText(values, 'customAgencyName') : null
  const fields = {
    agencyCode,
    customAgencyName,
    memberNumber: requiredText(values, 'memberNumber'),
    updatedAt: new Date(),
  }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(agencyMemberships)
          .values({ ...fields, diverId: await primaryDiverId() })
          .returning({ id: agencyMemberships.id })
      : await getDb()
          .update(agencyMemberships)
          .set(fields)
          .where(eq(agencyMemberships.id, recordId(id)))
          .returning({ id: agencyMemberships.id })
  if (!row) throw new Error('Agency membership was not found')
  return row.id
}

export type DeletableEntityKey = Exclude<EntityKey, 'divers'>

const deletableEntities: Record<
  DeletableEntityKey,
  {
    table:
      | typeof diveSites
      | typeof buddies
      | typeof equipment
      | typeof certifications
      | typeof agencyMemberships
    canonicalType: string
  }
> = {
  sites: { table: diveSites, canonicalType: 'dive_site' },
  buddies: { table: buddies, canonicalType: 'buddy' },
  equipment: { table: equipment, canonicalType: 'equipment' },
  certifications: { table: certifications, canonicalType: 'certification' },
  agencyMemberships: {
    table: agencyMemberships,
    canonicalType: 'agency_membership',
  },
}

export async function deleteDataRecord(entity: DeletableEntityKey, id: string) {
  const { table, canonicalType } = deletableEntities[entity]
  const targetId = recordId(id)

  // Certification card scans live in object storage; clean them up best-effort.
  let scanPaths: string[] = []
  if (entity === 'certifications') {
    const [row] = await getDb()
      .select({
        scan1: certifications.scan1StoragePath,
        scan1Thumbnail: certifications.scan1ThumbnailStoragePath,
        scan2: certifications.scan2StoragePath,
        scan2Thumbnail: certifications.scan2ThumbnailStoragePath,
      })
      .from(certifications)
      .where(eq(certifications.id, targetId))
      .limit(1)
    scanPaths = [row?.scan1, row?.scan1Thumbnail, row?.scan2, row?.scan2Thumbnail].filter(
      (path): path is string => Boolean(path),
    )
  }

  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, canonicalType),
          eq(externalRecordLinks.canonicalEntityId, targetId),
        ),
      )
    const [row] = await transaction
      .delete(table)
      .where(eq(table.id, targetId))
      .returning({ id: table.id })
    if (!row) throw new Error('The record was not found')
  })

  const storage = getStorage()
  await Promise.allSettled(scanPaths.map((path) => storage.delete(path)))
}

export async function saveDataRecord(
  entity: EntityKey,
  id: string,
  values: EditorValues,
) {
  switch (entity) {
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
    case 'agencyMemberships':
      return saveAgencyMembership(id, values)
  }
}
