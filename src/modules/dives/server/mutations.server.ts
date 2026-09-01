import '@tanstack/react-start/server-only'

import { and, asc, eq, ilike, inArray } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  diveBuddies,
  diveEquipment,
  divers,
  dives,
  diveTypes,
  externalRecordLinks,
  shops,
  tanks,
} from '@/db/schema'
import type { DiveEntryInput } from './mutations'

function text(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function decimal(
  value: string,
  label: string,
  limits: { min?: number; max?: number } = {},
) {
  const raw = text(value)
  if (raw === null) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number`)
  if (limits.min !== undefined && parsed < limits.min) {
    throw new Error(`${label} must be at least ${limits.min}`)
  }
  if (limits.max !== undefined && parsed > limits.max) {
    throw new Error(`${label} must be at most ${limits.max}`)
  }
  return raw
}

function integer(
  value: string,
  label: string,
  limits: { min?: number; max?: number } = {},
) {
  const raw = decimal(value, label, limits)
  if (raw === null) return null
  if (!/^-?\d+$/.test(raw)) throw new Error(`${label} must be a whole number`)
  return Number(raw)
}

function minutesToSeconds(value: string, label: string) {
  const raw = decimal(value, label, { min: 0 })
  return raw === null ? null : Math.round(Number(raw) * 60)
}

type Transaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

async function resolveNamedRecord(
  transaction: Transaction,
  table: typeof shops | typeof diveTypes,
  selectedId: string,
  newName: string,
) {
  const name = text(newName)
  if (name) {
    const [existing] = await transaction
      .select({ id: table.id })
      .from(table)
      .where(ilike(table.name, name))
      .limit(1)
    if (existing) return existing.id
    const [created] = await transaction
      .insert(table)
      .values({ name })
      .returning({ id: table.id })
    return created?.id ?? null
  }
  return text(selectedId)
}

function parseTanks(input: DiveEntryInput['tanks']) {
  return input.map((tank, index) => {
    const oxygenPercent = decimal(tank.oxygenPercent, 'Oxygen', { min: 0, max: 100 })
    const heliumPercent = decimal(tank.heliumPercent, 'Helium', { min: 0, max: 100 })
    if (Number(oxygenPercent ?? 0) + Number(heliumPercent ?? 0) > 100) {
      throw new Error('Oxygen and helium of a tank cannot exceed 100% combined')
    }
    const startPressureBar = decimal(tank.startPressureBar, 'Start pressure', {
      min: 0,
    })
    const endPressureBar = decimal(tank.endPressureBar, 'End pressure', { min: 0 })
    if (
      startPressureBar !== null &&
      endPressureBar !== null &&
      Number(endPressureBar) > Number(startPressureBar)
    ) {
      throw new Error('A tank cannot end with more pressure than it started with')
    }
    return {
      id: tank.id,
      sortOrder: index,
      fields: {
        name: text(tank.name),
        volumeLiters: decimal(tank.volumeLiters, 'Tank volume', { min: 0 }),
        oxygenPercent,
        heliumPercent,
        startPressureBar,
        endPressureBar,
      },
    }
  })
}

export async function saveDiveEntry(input: DiveEntryInput) {
  const { dive } = input
  const maximumDepthMeters = decimal(dive.maximumDepthMeters, 'Maximum depth', {
    min: 0,
  })
  const averageDepthMeters = decimal(dive.averageDepthMeters, 'Average depth', {
    min: 0,
  })
  if (
    maximumDepthMeters !== null &&
    averageDepthMeters !== null &&
    Number(averageDepthMeters) > Number(maximumDepthMeters)
  ) {
    throw new Error('Average depth cannot exceed maximum depth')
  }

  const fields = {
    siteId: text(dive.siteId),
    number: integer(dive.number, 'Dive number', { min: 1 }),
    diveDate: dive.diveDate,
    entryTime: text(dive.entryTime),
    durationSeconds: minutesToSeconds(dive.durationMinutes, 'Duration') ?? 0,
    surfaceIntervalSeconds: minutesToSeconds(
      dive.surfaceIntervalMinutes,
      'Surface interval',
    ),
    maximumDepthMeters,
    averageDepthMeters,
    airTemperatureCelsius: decimal(dive.airTemperatureCelsius, 'Air temperature'),
    waterTemperatureCelsius: decimal(dive.waterTemperatureCelsius, 'Water temperature'),
    weightKg: decimal(dive.weightKg, 'Weight', { min: 0 }),
    equipmentWeightKg: decimal(dive.equipmentWeightKg, 'Equipment weight', { min: 0 }),
    decompressionDive: dive.decompressionDive,
    waterType: integer(dive.waterType, 'Water type', { min: 0 }),
    entryType: integer(dive.entryType, 'Entry type', { min: 0 }),
    visibility: text(dive.visibility),
    current: text(dive.current),
    waves: text(dive.waves),
    weather: text(dive.weather),
    rating: dive.rating === 0 ? null : dive.rating,
    computer: text(dive.computer),
    suit: text(dive.suit),
    boat: text(dive.boat),
    divemaster: text(dive.divemaster),
    notes: text(dive.notes),
    updatedAt: new Date(),
  }
  const parsedTanks = parseTanks(input.tanks)

  return getDb().transaction(async (transaction) => {
    const [shopId, diveTypeId] = await Promise.all([
      resolveNamedRecord(transaction, shops, dive.shopId, dive.newShopName),
      resolveNamedRecord(transaction, diveTypes, dive.diveTypeId, dive.newDiveTypeName),
    ])

    let diveRowId: string
    if (input.diveId === 'new') {
      const [primaryDiver] = await transaction
        .select({ id: divers.id })
        .from(divers)
        .orderBy(asc(divers.createdAt))
        .limit(1)
      const [row] = await transaction
        .insert(dives)
        .values({ ...fields, shopId, diveTypeId, diverId: primaryDiver?.id ?? null })
        .returning({ id: dives.id })
      if (!row) throw new Error('The dive could not be created')
      diveRowId = row.id
    } else {
      const [row] = await transaction
        .update(dives)
        .set({ ...fields, shopId, diveTypeId })
        .where(eq(dives.id, input.diveId))
        .returning({ id: dives.id })
      if (!row) throw new Error('The dive was not found')
      diveRowId = row.id
    }

    await transaction.delete(diveBuddies).where(eq(diveBuddies.diveId, diveRowId))
    const buddyIds = Array.from(new Set(input.buddyIds))
    if (buddyIds.length > 0) {
      await transaction
        .insert(diveBuddies)
        .values(buddyIds.map((buddyId) => ({ diveId: diveRowId, buddyId })))
    }

    await transaction.delete(diveEquipment).where(eq(diveEquipment.diveId, diveRowId))
    const equipmentIds = Array.from(new Set(input.equipmentIds))
    if (equipmentIds.length > 0) {
      await transaction
        .insert(diveEquipment)
        .values(equipmentIds.map((equipmentId) => ({ diveId: diveRowId, equipmentId })))
    }

    // Update existing tanks in place (preserving imported computer metadata),
    // insert new ones, and delete only the tanks the user removed.
    const existingTanks = await transaction
      .select({ id: tanks.id })
      .from(tanks)
      .where(eq(tanks.diveId, diveRowId))
    const existingIds = new Set(existingTanks.map((tank) => tank.id))
    const keptIds = new Set(
      parsedTanks.flatMap((tank) =>
        tank.id && existingIds.has(tank.id) ? [tank.id] : [],
      ),
    )
    const removedIds = [...existingIds].filter((id) => !keptIds.has(id))
    if (removedIds.length > 0) {
      await transaction.delete(tanks).where(inArray(tanks.id, removedIds))
    }
    for (const tank of parsedTanks) {
      if (tank.id && keptIds.has(tank.id)) {
        await transaction
          .update(tanks)
          .set({ ...tank.fields, sortOrder: tank.sortOrder, updatedAt: new Date() })
          .where(eq(tanks.id, tank.id))
      } else {
        await transaction
          .insert(tanks)
          .values({ ...tank.fields, diveId: diveRowId, sortOrder: tank.sortOrder })
      }
    }

    return diveRowId
  })
}

export async function deleteDiveEntry(diveId: string) {
  return getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'dive'),
          eq(externalRecordLinks.canonicalEntityId, diveId),
        ),
      )
    const [row] = await transaction
      .delete(dives)
      .where(eq(dives.id, diveId))
      .returning({ id: dives.id })
    if (!row) throw new Error('The dive was not found')
  })
}
