import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  certifications,
  equipment,
  externalRecordLinks,
  externalRecords,
  importRuns,
  integrationState,
  integrations,
} from '@/db/schema'
import { performIncrementalImport } from '@/modules/integrations/server/import-service.server'
import { saveIntegrationEntitySelection } from '@/modules/integrations/server/operations.server'
import type { GarminSourceBatch, GarminSourceGear } from '../types'
import { createGarminConnector } from './connector.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'

function regulator(overrides: Record<string, unknown> = {}): GarminSourceGear {
  return {
    gearId: '141548',
    type: 'REGULATOR',
    detail: {
      name: 'Atomic B2',
      type: 'REGULATOR',
      brand: 'Atomic Aquatics',
      model: 'B2',
      serialNumber: 'REG-1',
      nextServiceDate: '2027-01-01',
      status: 'ACTIVE',
      ...overrides,
    },
  }
}

function certification(name: string): GarminSourceGear {
  return {
    gearId: '463947',
    type: 'CERTIFICATION',
    detail: { name, type: 'CERTIFICATION', dateOfFirstUse: '2025-01-01' },
  }
}

let batch: GarminSourceBatch = {
  activities: [],
  nextState: {},
  sourceDescription: 'test',
}
let includeGearSeen: boolean | undefined

const connector = createGarminConnector({
  async fetchFull() {
    throw new Error('not used')
  },
  async fetchIncremental(_state, options) {
    includeGearSeen = options?.includeGear
    return options?.includeGear ? batch : { ...batch, gear: undefined }
  },
})

async function run(gear: GarminSourceGear[]) {
  batch = { activities: [], gear, nextState: {}, sourceDescription: 'Garmin test feed' }
  return performIncrementalImport(connector, { trigger: 'manual' })
}

describe.skipIf(!enabled)('Garmin gear and certification import', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(equipment)
    await db.delete(certifications)
    await db.delete(integrationState).where(eq(integrationState.integrationKey, 'garmin'))
    await db.delete(externalRecords).where(eq(externalRecords.integrationKey, 'garmin'))
    await db.delete(importRuns).where(eq(importRuns.integrationKey, 'garmin'))
    await db.delete(integrations).where(eq(integrations.key, 'garmin'))
  })

  afterAll(async () => {
    await closeDb()
  })

  test('creates, matches by name, updates, and honours the entity switches', async () => {
    // A locally owned item with the same name as Garmin's is matched, not
    // duplicated, and only its empty fields are filled in.
    const [local] = await getDb()
      .insert(equipment)
      .values({ name: 'atomic b2', manufacturer: 'My brand' })
      .returning({ id: equipment.id })

    const first = await run([regulator(), certification('Deep Diver')])
    expect(first.canonical.byEntity).toMatchObject({
      gearMatched: 1,
      certificationsCreated: 1,
    })
    const gearRows = await getDb().select().from(equipment)
    expect(gearRows).toHaveLength(1)
    expect(gearRows[0]).toMatchObject({
      id: local?.id,
      manufacturer: 'My brand',
      model: 'B2',
      serialNumber: 'REG-1',
      serviceDueAt: '2027-01-01',
    })
    const links = await getDb()
      .select({
        role: externalRecordLinks.role,
        type: externalRecordLinks.canonicalEntityType,
      })
      .from(externalRecordLinks)
      .innerJoin(
        externalRecords,
        eq(externalRecordLinks.externalRecordId, externalRecords.id),
      )
      .where(eq(externalRecords.integrationKey, 'garmin'))
    expect(links.sort((a, b) => a.type.localeCompare(b.type))).toEqual([
      { role: 'produced', type: 'certification' },
      { role: 'matched', type: 'equipment' },
    ])

    // Unchanged records are skipped; a changed certification updates in place.
    const second = await run([regulator(), certification('Deep Diver Specialty')])
    expect(second.records).toMatchObject({ skipped: 1, updated: 1 })
    expect((await getDb().select().from(certifications))[0]?.name).toBe(
      'Deep Diver Specialty',
    )

    // A matched item is never rewritten from Garmin, even when Garmin changes.
    await run([
      regulator({ brand: 'Changed upstream' }),
      certification('Deep Diver Specialty'),
    ])
    expect((await getDb().select().from(equipment))[0]?.manufacturer).toBe('My brand')

    // With both gear entities off the source is not asked for gear at all.
    await saveIntegrationEntitySelection('garmin', ['equipment', 'certifications'])
    const off = await run([
      regulator({ name: 'Brand new item' }),
      certification('Rescue'),
    ])
    expect(includeGearSeen).toBe(false)
    expect(off.records.discovered).toBe(0)
    expect(await getDb().select().from(equipment)).toHaveLength(1)

    // Only certifications off: gear is still fetched, certification records dropped.
    await saveIntegrationEntitySelection('garmin', ['certifications'])
    const certsOff = await run([
      regulator(),
      { gearId: '77', type: 'MASK', detail: { name: 'Frameless mask', type: 'MASK' } },
      certification('Rescue'),
    ])
    expect(includeGearSeen).toBe(true)
    expect(certsOff.diagnostics).toMatchObject({ recordsSkippedByEntity: 1 })
    expect(certsOff.canonical.byEntity).toMatchObject({ gearCreated: 1 })
    expect(await getDb().select().from(equipment)).toHaveLength(2)
    expect(await getDb().select().from(certifications)).toHaveLength(1)
    await saveIntegrationEntitySelection('garmin', [])
  })
})
