import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { asc, eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  buddies,
  diveBuddies,
  diveEquipment,
  divers,
  diveSites,
  dives,
  equipment,
  externalRecordLinks,
  externalRecords,
  integrations,
  tanks,
} from '@/db/schema'
import type { DiveEntryInput } from './mutations'
import { deleteDiveEntry, saveDiveEntry } from './mutations.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-dive-mutations'

function baseInput(overrides: Partial<DiveEntryInput['dive']> = {}): DiveEntryInput {
  return {
    diveId: 'new',
    dive: {
      number: '',
      diveDate: '2026-02-01',
      entryTime: '',
      durationMinutes: '',
      surfaceIntervalMinutes: '',
      maximumDepthMeters: '',
      averageDepthMeters: '',
      airTemperatureCelsius: '',
      waterTemperatureCelsius: '',
      weightKg: '',
      equipmentWeightKg: '',
      decompressionDive: false,
      safetyStop: false,
      safetyStopMinutes: '',
      pressureGroupBeforeInterval: '',
      pressureGroupAfterInterval: '',
      pressureGroupEnd: '',
      residualNitrogenMinutes: '',
      waterType: '',
      entryType: '',
      visibility: '',
      current: '',
      waves: '',
      weather: '',
      rating: 0,
      computer: '',
      suit: '',
      boatId: '',
      notes: '',
      siteId: '',
      shopId: '',
      diveTypeId: '',
      ...overrides,
    },
    buddyAssignments: [],
    equipmentIds: [],
    tanks: [],
  }
}

describe.skipIf(!enabled)('manual dive mutations database contract', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(externalRecords)
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
    await db.delete(dives)
    await db.delete(buddies)
    await db.delete(equipment)
    await db.delete(diveSites)
    await db.delete(divers)
    await db.insert(divers).values({ firstName: 'Primary' })
  })

  afterAll(async () => {
    await closeDb()
  })

  test('creates a dive with validated fields, deduped associations, and tanks assigned to the primary diver', async () => {
    const db = getDb()
    const [buddyA] = await db
      .insert(buddies)
      .values({ firstName: 'A' })
      .returning({ id: buddies.id })
    const [buddyB] = await db
      .insert(buddies)
      .values({ firstName: 'B' })
      .returning({ id: buddies.id })
    const [gearA] = await db
      .insert(equipment)
      .values({ name: 'BCD' })
      .returning({ id: equipment.id })
    if (!buddyA || !buddyB || !gearA) throw new Error('Seed rows were not created')
    const [primaryDiver] = await db
      .select({ id: divers.id })
      .from(divers)
      .orderBy(asc(divers.createdAt))
      .limit(1)
    if (!primaryDiver) throw new Error('Primary diver seed is missing')

    const input = baseInput({
      number: '12',
      durationMinutes: '45',
      maximumDepthMeters: '20',
      averageDepthMeters: '12',
    })
    input.buddyAssignments = [
      { buddyId: buddyA.id, role: 'buddy' },
      // A duplicate assignment for the same buddy must collapse to one row,
      // keeping the last-listed role for that buddy.
      { buddyId: buddyA.id, role: 'guide' },
      { buddyId: buddyB.id, role: 'instructor' },
    ]
    input.equipmentIds = [gearA.id, gearA.id]
    input.tanks = [
      {
        id: null,
        name: 'Air',
        volumeLiters: '12',
        oxygenPercent: '21',
        heliumPercent: '',
        startPressureBar: '200',
        endPressureBar: '80',
      },
    ]

    const diveId = await saveDiveEntry(input)

    const [dive] = await db.select().from(dives).where(eq(dives.id, diveId))
    expect(dive).toMatchObject({
      number: 12,
      durationSeconds: 45 * 60,
      maximumDepthMeters: '20.00',
      averageDepthMeters: '12.00',
      diverId: primaryDiver.id,
    })

    const savedBuddies = await db
      .select({ buddyId: diveBuddies.buddyId, role: diveBuddies.role })
      .from(diveBuddies)
      .where(eq(diveBuddies.diveId, diveId))
    expect(savedBuddies.sort((a, b) => a.buddyId.localeCompare(b.buddyId))).toEqual(
      [buddyA, buddyB]
        .map((buddy) => ({
          buddyId: buddy.id,
          role: buddy.id === buddyA.id ? ('guide' as const) : ('instructor' as const),
        }))
        .sort((a, b) => a.buddyId.localeCompare(b.buddyId)),
    )

    const savedEquipment = await db
      .select({ equipmentId: diveEquipment.equipmentId })
      .from(diveEquipment)
      .where(eq(diveEquipment.diveId, diveId))
    expect(savedEquipment).toEqual([{ equipmentId: gearA.id }])

    const savedTanks = await db.select().from(tanks).where(eq(tanks.diveId, diveId))
    expect(savedTanks).toHaveLength(1)
    expect(savedTanks[0]).toMatchObject({
      name: 'Air',
      oxygenPercent: '21.00',
      startPressureBar: '200.00',
      endPressureBar: '80.00',
    })
  })

  test('rejects invalid numeric and gas input before writing anything', async () => {
    const beforeDives = await getDb().select({ id: dives.id }).from(dives)

    await expect(
      saveDiveEntry(baseInput({ maximumDepthMeters: '10', averageDepthMeters: '20' })),
    ).rejects.toThrow('Average depth cannot exceed maximum depth')

    const withBadGas = baseInput()
    withBadGas.tanks = [
      {
        id: null,
        name: 'Bad mix',
        volumeLiters: '',
        oxygenPercent: '80',
        heliumPercent: '30',
        startPressureBar: '',
        endPressureBar: '',
      },
    ]
    await expect(saveDiveEntry(withBadGas)).rejects.toThrow(
      'Oxygen and helium of a tank cannot exceed 100% combined',
    )

    const afterDives = await getDb().select({ id: dives.id }).from(dives)
    expect(afterDives).toHaveLength(beforeDives.length)
  })

  test('updating a dive replaces associations and reconciles tanks by id (keep, add, remove)', async () => {
    const db = getDb()
    const [buddyA] = await db
      .insert(buddies)
      .values({ firstName: 'Keep' })
      .returning({ id: buddies.id })
    const [buddyC] = await db
      .insert(buddies)
      .values({ firstName: 'Replacement' })
      .returning({ id: buddies.id })
    if (!buddyA || !buddyC) throw new Error('Seed buddies were not created')

    const created = baseInput({ durationMinutes: '30' })
    created.buddyAssignments = [{ buddyId: buddyA.id, role: 'buddy' }]
    created.tanks = [
      {
        id: null,
        name: 'Kept tank',
        volumeLiters: '11',
        oxygenPercent: '21',
        heliumPercent: '',
        startPressureBar: '200',
        endPressureBar: '100',
      },
      {
        id: null,
        name: 'Removed tank',
        volumeLiters: '11',
        oxygenPercent: '21',
        heliumPercent: '',
        startPressureBar: '200',
        endPressureBar: '100',
      },
    ]
    const diveId = await saveDiveEntry(created)
    const existingTanks = await db
      .select({ id: tanks.id, name: tanks.name })
      .from(tanks)
      .where(eq(tanks.diveId, diveId))
      .orderBy(asc(tanks.sortOrder))
    const kept = existingTanks.find((tank) => tank.name === 'Kept tank')
    if (!kept) throw new Error('Seed tank was not created')

    const update = baseInput({ durationMinutes: '30' })
    update.diveId = diveId
    // The buddy list is fully replaced, not merged.
    update.buddyAssignments = [{ buddyId: buddyC.id, role: 'guide' }]
    update.tanks = [
      // Same id, changed pressure: update in place.
      {
        id: kept.id,
        name: 'Kept tank',
        volumeLiters: '11',
        oxygenPercent: '21',
        heliumPercent: '',
        startPressureBar: '200',
        endPressureBar: '40',
      },
      // No id: a new tank.
      {
        id: null,
        name: 'Added tank',
        volumeLiters: '11',
        oxygenPercent: '32',
        heliumPercent: '',
        startPressureBar: '200',
        endPressureBar: '90',
      },
      // "Removed tank" is omitted and must be deleted.
    ]
    await saveDiveEntry(update)

    const finalBuddies = await db
      .select({ buddyId: diveBuddies.buddyId })
      .from(diveBuddies)
      .where(eq(diveBuddies.diveId, diveId))
    expect(finalBuddies).toEqual([{ buddyId: buddyC.id }])

    const finalTanks = await db
      .select({ id: tanks.id, name: tanks.name, endPressureBar: tanks.endPressureBar })
      .from(tanks)
      .where(eq(tanks.diveId, diveId))
      .orderBy(asc(tanks.sortOrder))
    expect(finalTanks.map((tank) => tank.name).sort()).toEqual(
      ['Added tank', 'Kept tank'].sort(),
    )
    const stillKept = finalTanks.find((tank) => tank.id === kept.id)
    expect(stillKept?.endPressureBar).toBe('40.00')
  })

  test('deleteDiveEntry removes provenance before deleting the dive, and rejects a missing dive', async () => {
    const db = getDb()
    const diveId = await saveDiveEntry(baseInput())

    await db.insert(integrations).values({
      key: INTEGRATION_KEY,
      displayName: 'Test dive mutation integration',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['dives'],
    })
    const [externalRecord] = await db
      .insert(externalRecords)
      .values({
        integrationKey: INTEGRATION_KEY,
        entityType: 'activity',
        identityKey: 'manual-delete-target',
        rawPayload: {},
        contentHash: 'hash-1',
      })
      .returning({ id: externalRecords.id })
    if (!externalRecord) throw new Error('Seed external record was not created')
    await db.insert(externalRecordLinks).values({
      externalRecordId: externalRecord.id,
      canonicalEntityType: 'dive',
      canonicalEntityId: diveId,
      role: 'produced',
    })

    await deleteDiveEntry(diveId)

    expect(await db.select().from(dives).where(eq(dives.id, diveId))).toHaveLength(0)
    expect(
      await db
        .select()
        .from(externalRecordLinks)
        .where(eq(externalRecordLinks.externalRecordId, externalRecord.id)),
    ).toHaveLength(0)

    await expect(deleteDiveEntry(diveId)).rejects.toThrow('The dive was not found')
  })
})
