import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FileIdMesg, RecordMesg, SessionMesg } from '@garmin/fitsdk'
import { Encoder, Profile } from '@garmin/fitsdk'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  certifications,
  diveProfileSamples,
  dives,
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

function messageNumber(name: string) {
  const value = Profile.MesgNum[name]
  if (value === undefined) throw new Error(`FIT profile is missing ${name}`)
  return value
}

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

describe.skipIf(!enabled)(
  'Garmin heart rate on a dive recorded by another computer',
  () => {
    test('keeps the existing profile and adds heart rate where samples have none', async () => {
      const db = getDb()
      await db.delete(dives)
      await db.delete(externalRecords).where(eq(externalRecords.integrationKey, 'garmin'))
      const startedAt = new Date('2026-09-05T09:00:00Z')
      const [existing] = await db
        .insert(dives)
        .values({
          diveDate: '2026-09-05',
          entryTime: '09:00:00',
          utcOffsetMinutes: 0,
          durationSeconds: 40,
          maximumDepthMeters: '9.00',
        })
        .returning({ id: dives.id })
      if (!existing) throw new Error('fixture dive missing')
      await db.insert(diveProfileSamples).values(
        [0, 10, 20, 30, 40].map((seconds, index) => ({
          diveId: existing.id,
          sampleIndex: index,
          elapsedSeconds: seconds,
          depthMeters: String(index * 2),
        })),
      )

      const encoder = new Encoder()
      encoder.onMesg(messageNumber('FILE_ID'), {
        type: 'activity',
        manufacturer: 'development',
        product: 1,
        timeCreated: startedAt,
      } as FileIdMesg)
      encoder.onMesg(messageNumber('SESSION'), {
        sport: 'diving',
        subSport: 'singleGasDiving',
        startTime: startedAt,
        timestamp: new Date(startedAt.getTime() + 40_000),
        totalTimerTime: 40,
        avgHeartRate: 90,
        maxHeartRate: 110,
        event: 'session',
        eventType: 'stop',
      } as SessionMesg)
      for (const [seconds, heartRate] of [
        [0, 80],
        [10, 100],
        [20, 0],
        [30, 110],
        [40, 85],
      ] as const) {
        encoder.onMesg(messageNumber('RECORD'), {
          timestamp: new Date(startedAt.getTime() + seconds * 1_000),
          depth: 3,
          heartRate,
        } as RecordMesg)
      }
      batch = {
        activities: [
          {
            activityDetails: {
              activityId: '555',
              activityType: 'single_gas_diving',
              startTimeInSeconds: startedAt.getTime() / 1_000,
              startTimeOffsetInSeconds: 0,
              durationInSeconds: 40,
            },
            fitBytes: encoder.close(),
            fitFileName: '555.fit',
            fitContentType: 'application/vnd.ant.fit',
          },
        ],
        nextState: {},
        sourceDescription: 'Garmin test feed',
      }
      const result = await performIncrementalImport(connector, { trigger: 'manual' })
      expect(result.canonical.byEntity).toMatchObject({
        divesMatched: 1,
        profileSamplesCreated: 0,
        heartRateSamplesFilled: 4,
      })

      const samples = await db
        .select({
          elapsedSeconds: diveProfileSamples.elapsedSeconds,
          depthMeters: diveProfileSamples.depthMeters,
          heartRateBpm: diveProfileSamples.heartRateBpm,
        })
        .from(diveProfileSamples)
        .where(eq(diveProfileSamples.diveId, existing.id))
        .orderBy(diveProfileSamples.elapsedSeconds)
      // The other computer's depths are untouched; the 0 bpm dropout stays empty.
      expect(samples).toEqual([
        { elapsedSeconds: 0, depthMeters: '0.00', heartRateBpm: 80 },
        { elapsedSeconds: 10, depthMeters: '2.00', heartRateBpm: 100 },
        { elapsedSeconds: 20, depthMeters: '4.00', heartRateBpm: null },
        { elapsedSeconds: 30, depthMeters: '6.00', heartRateBpm: 110 },
        { elapsedSeconds: 40, depthMeters: '8.00', heartRateBpm: 85 },
      ])
      const [dive] = await db.select().from(dives).where(eq(dives.id, existing.id))
      expect(dive).toMatchObject({
        maximumDepthMeters: '9.00',
        averageHeartRateBpm: 90,
        maximumHeartRateBpm: 110,
        captureSource: 'computer',
      })
    })
  },
)
