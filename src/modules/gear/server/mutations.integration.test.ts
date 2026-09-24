import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { asc, eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  divers,
  equipment,
  equipmentSetItems,
  equipmentSets,
  externalRecordLinks,
  externalRecords,
  integrations,
} from '@/db/schema'
import {
  deleteEquipment,
  deleteGearSet,
  saveEquipment,
  saveGearSet,
} from './mutations.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-gear-mutations'

describe.skipIf(!enabled)('manual gear-set mutations database contract', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(externalRecords)
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
    await db.delete(equipmentSetItems)
    await db.delete(equipmentSets)
    await db.delete(equipment)
  })

  afterAll(async () => {
    await closeDb()
  })

  test('creates a gear set and replaces its membership on update, deduping and reordering items', async () => {
    const db = getDb()
    const [itemA] = await db
      .insert(equipment)
      .values({ name: 'BCD' })
      .returning({ id: equipment.id })
    const [itemB] = await db
      .insert(equipment)
      .values({ name: 'Regulator' })
      .returning({ id: equipment.id })
    const [itemC] = await db
      .insert(equipment)
      .values({ name: 'Fins' })
      .returning({ id: equipment.id })
    if (!itemA || !itemB || !itemC) throw new Error('Seed equipment was not created')

    const created = await saveGearSet({
      id: 'new',
      name: 'Warm water kit',
      notes: '',
      inactive: false,
      equipmentIds: [itemA.id, itemB.id, itemA.id],
    })

    const [set] = await db
      .select()
      .from(equipmentSets)
      .where(eq(equipmentSets.id, created.id))
    expect(set).toMatchObject({ name: 'Warm water kit', inactive: false, notes: null })

    const createdItems = await db
      .select({ equipmentId: equipmentSetItems.equipmentId })
      .from(equipmentSetItems)
      .where(eq(equipmentSetItems.equipmentSetId, created.id))
      .orderBy(asc(equipmentSetItems.sortOrder))
    expect(createdItems.map((item) => item.equipmentId)).toEqual([itemA.id, itemB.id])

    await saveGearSet({
      id: created.id,
      name: 'Warm water kit',
      notes: 'Updated',
      inactive: true,
      equipmentIds: [itemC.id, itemB.id],
    })

    const [updatedSet] = await db
      .select()
      .from(equipmentSets)
      .where(eq(equipmentSets.id, created.id))
    expect(updatedSet).toMatchObject({ inactive: true, notes: 'Updated' })

    const updatedItems = await db
      .select({ equipmentId: equipmentSetItems.equipmentId })
      .from(equipmentSetItems)
      .where(eq(equipmentSetItems.equipmentSetId, created.id))
      .orderBy(asc(equipmentSetItems.sortOrder))
    expect(updatedItems.map((item) => item.equipmentId)).toEqual([itemC.id, itemB.id])
  })

  test('deleteGearSet removes provenance before deleting the set, and rejects a missing set', async () => {
    const db = getDb()
    const created = await saveGearSet({
      id: 'new',
      name: 'Cold water kit',
      notes: '',
      inactive: false,
      equipmentIds: [],
    })

    await db.insert(integrations).values({
      key: INTEGRATION_KEY,
      displayName: 'Test gear mutation integration',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['equipmentSets'],
    })
    const [externalRecord] = await db
      .insert(externalRecords)
      .values({
        integrationKey: INTEGRATION_KEY,
        entityType: 'equipment_set',
        identityKey: 'set-1',
        rawPayload: {},
        contentHash: 'hash-1',
      })
      .returning({ id: externalRecords.id })
    if (!externalRecord) throw new Error('Seed external record was not created')
    await db.insert(externalRecordLinks).values({
      externalRecordId: externalRecord.id,
      canonicalEntityType: 'equipment_set',
      canonicalEntityId: created.id,
      role: 'produced',
    })

    await deleteGearSet(created.id)

    expect(
      await db.select().from(equipmentSets).where(eq(equipmentSets.id, created.id)),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(externalRecordLinks)
        .where(eq(externalRecordLinks.externalRecordId, externalRecord.id)),
    ).toHaveLength(0)

    await expect(deleteGearSet(created.id)).rejects.toThrow('Gear set was not found')
  })
})

describe.skipIf(!enabled)('manual equipment mutations database contract', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(externalRecords)
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
    await db.delete(equipmentSetItems)
    await db.delete(equipment)
  })

  afterAll(async () => {
    await closeDb()
  })

  test('creates equipment under the primary diver, updates one field, then deletes it', async () => {
    const db = getDb()
    await db.delete(divers)
    const [primaryDiver] = await db
      .insert(divers)
      .values({ firstName: 'Primary' })
      .returning({ id: divers.id })
    if (!primaryDiver) throw new Error('Seed diver was not created')

    const equipmentId = await saveEquipment('new', {
      name: 'Regulator',
      manufacturer: 'Atomic',
      weightKg: 2.4,
    })
    const [item] = await db.select().from(equipment).where(eq(equipment.id, equipmentId))
    expect(item).toMatchObject({
      name: 'Regulator',
      manufacturer: 'Atomic',
      weightKg: '2.400',
      diverId: primaryDiver.id,
    })

    await saveEquipment(equipmentId, { manufacturer: 'Scubapro' })
    const [updated] = await db
      .select()
      .from(equipment)
      .where(eq(equipment.id, equipmentId))
    expect(updated?.manufacturer).toBe('Scubapro')
    expect(updated?.name).toBe('Regulator')

    await db.insert(integrations).values({
      key: INTEGRATION_KEY,
      displayName: 'Test equipment mutation integration',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['equipment'],
    })
    const [externalRecord] = await db
      .insert(externalRecords)
      .values({
        integrationKey: INTEGRATION_KEY,
        entityType: 'equipment',
        identityKey: 'gear-1',
        rawPayload: {},
        contentHash: 'hash-gear',
      })
      .returning({ id: externalRecords.id })
    if (!externalRecord) throw new Error('Seed external record was not created')
    await db.insert(externalRecordLinks).values({
      externalRecordId: externalRecord.id,
      canonicalEntityType: 'equipment',
      canonicalEntityId: equipmentId,
      role: 'produced',
    })

    await deleteEquipment(equipmentId)
    expect(
      await db.select().from(equipment).where(eq(equipment.id, equipmentId)),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(externalRecordLinks)
        .where(eq(externalRecordLinks.externalRecordId, externalRecord.id)),
    ).toHaveLength(0)
    await expect(deleteEquipment(equipmentId)).rejects.toThrow('The record was not found')
  })
})
