import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  buddies,
  certifications,
  diveBuddies,
  diveProfileSamples,
  diveSites,
  dives,
  externalRecordLinks,
  externalRecords,
  importRuns,
  integrationState,
  integrations,
  tanks,
} from '@/db/schema'
import { performIncrementalImport } from '@/modules/integrations/server/import-service.server'
import { saveIntegrationEntitySelection } from '@/modules/integrations/server/operations.server'
import type { IntegrationConnector } from '@/modules/integrations/types'
import type {
  DiveMateBuddy,
  DiveMateCertification,
  DiveMateDive,
  DiveMateProfileSample,
  DiveMateSite,
  DiveMateSnapshot,
  DiveMateSourceRecord,
  DiveMateTank,
} from '../types'
import { diveMateConnector } from './sync.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'

function source(
  externalId: string,
  payload: Record<string, unknown>,
): DiveMateSourceRecord {
  return {
    externalId,
    externalUuid: null,
    sourceUpdatedAt: null,
    sourcePayload: { ID: Number(externalId), ...payload },
  }
}

function site(name: string): DiveMateSite {
  return {
    ...source('7', { Place: name }),
    name,
    country: null,
    region: null,
    waterName: null,
    latitude: null,
    longitude: null,
    sourceLatitude: null,
    sourceLongitude: null,
    maximumDepthMeters: null,
    altitudeMeters: null,
    difficulty: null,
    rating: null,
    waterType: null,
    notes: null,
  }
}

function buddy(externalId: string, firstName: string): DiveMateBuddy {
  return {
    ...source(externalId, { FirstName: firstName }),
    firstName,
    lastName: 'Buddy',
    email: null,
    phone: null,
    street: null,
    postalCode: null,
    city: null,
    state: null,
    country: null,
    notes: null,
  }
}

function certification(name: string): DiveMateCertification {
  return {
    ...source('3', { Brevet: name }),
    diverExternalId: null,
    name,
    organization: null,
    certificationNumber: '42',
    certifiedAt: '2024-05-01',
    instructorName: null,
    instructorNumber: null,
    sortOrder: 1,
    scan1Path: null,
    scan2Path: null,
    scan1Bytes: null,
    scan1MimeType: null,
    scan2Bytes: null,
    scan2MimeType: null,
  }
}

function dive(notes: string, buddyName: string | null): DiveMateDive {
  return {
    ...source('11', { Comments: notes, Buddy: buddyName }),
    captureSource: 'computer',
    diverExternalId: null,
    siteExternalId: '7',
    shopExternalId: null,
    diveTypeExternalId: null,
    buddyExternalIds: ['4'],
    equipmentExternalIds: [],
    number: 1,
    diveDate: '2026-09-01',
    entryTime: '10:00',
    utcOffsetMinutes: null,
    durationSeconds: 2_400,
    surfaceIntervalSeconds: null,
    maximumDepthMeters: '18.0',
    averageDepthMeters: null,
    airTemperatureCelsius: null,
    waterTemperatureCelsius: null,
    weightKg: null,
    equipmentWeightKg: null,
    maximumPpo2: null,
    decompressionDive: false,
    visibility: null,
    current: null,
    waves: null,
    weather: null,
    waterType: null,
    entryType: null,
    rating: null,
    computer: null,
    suit: null,
    boat: null,
    divemaster: null,
    buddyName,
    notes,
  }
}

function tank(startPressureBar: string): DiveMateTank {
  return {
    ...source('21', { LogID: 11, PressureStart: startPressureBar }),
    diveExternalId: '11',
    name: 'Main',
    sortOrder: 0,
    computerTankNumber: 1,
    tankType: null,
    volumeLiters: '12',
    startPressureBar,
    endPressureBar: '60',
    workingPressureBar: null,
    oxygenPercent: '21',
    heliumPercent: null,
    breathingTimeSeconds: null,
    supplyTypeCode: null,
    weightKg: null,
    divePhaseCode: null,
  }
}

function samples(count: number): DiveMateProfileSample[] {
  return Array.from({ length: count }, (_, index) => ({
    ...source(`11:${index}`, {}),
    diveExternalId: '11',
    sampleIndex: index,
    elapsedSeconds: index * 10,
    depthMeters: String(index),
    temperatureCelsius: null,
    pressureBar: null,
    tank1PressureBar: null,
    tank2PressureBar: null,
    decoCeilingMeters: null,
    tankNumber: null,
  }))
}

function snapshot(overrides: Partial<DiveMateSnapshot>): DiveMateSnapshot {
  return {
    sourceTables: ['DBInfo', 'Logbook'],
    databaseVersion: '4.0',
    databaseProgram: 'DiveMate',
    databaseUuid: 'test',
    databaseUpdatedAt: null,
    divers: [],
    sites: [site('Blue Hole')],
    buddies: [buddy('4', 'Sam')],
    equipment: [],
    certifications: [certification('Open Water')],
    shops: [],
    diveTypes: [],
    discardedDiveExternalIds: [],
    dives: [dive('first', null)],
    tanks: [tank('200')],
    pictures: [],
    profileSamples: samples(3),
    ...overrides,
  }
}

type PreparedData = Parameters<
  typeof diveMateConnector.applyImport
>[0]['prepared']['data']

/** The real DiveMate connector with the Google Drive fetch replaced by a fixture. */
function connectorFor(data: DiveMateSnapshot): IntegrationConnector<PreparedData> {
  return {
    ...diveMateConnector,
    async prepareImport() {
      const storedMedia = {
        pictures: new Map(),
        certificationScans: new Map(),
      }
      return {
        records: [
          ...data.sites.map((item) => record('dive_site', item)),
          ...data.buddies.map((item) => record('buddy', item)),
          ...data.certifications.map((item) => record('certification', item)),
          ...data.dives.map((item) => record('dive', item)),
          ...data.tanks.map((item) => record('tank', item)),
        ],
        data: { snapshot: data, storedMedia },
        nextState: {},
        validation: { complete: true, sourceDescription: 'DiveMate fixture' },
      }
    },
  }
}

function record(entityType: string, item: DiveMateSourceRecord) {
  return {
    entityType,
    identityKey: item.externalId,
    externalId: item.externalId,
    rawPayload: item.sourcePayload,
    mapperVersion: entityType === 'dive_type' ? 4 : entityType === 'dive' ? 2 : 1,
  }
}

async function importSnapshot(data: DiveMateSnapshot) {
  return performIncrementalImport(connectorFor(data), { trigger: 'manual' })
}

async function currentDive() {
  const [row] = await getDb().select().from(dives)
  if (!row) throw new Error('The fixture dive is missing')
  return row
}

describe.skipIf(!enabled)('DiveMate entity selection', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(dives)
    await db.delete(buddies)
    await db.delete(certifications)
    await db
      .delete(integrationState)
      .where(eq(integrationState.integrationKey, 'divemate'))
    await db.delete(externalRecords).where(eq(externalRecords.integrationKey, 'divemate'))
    await db.delete(importRuns).where(eq(importRuns.integrationKey, 'divemate'))
    await db.delete(integrations).where(eq(integrations.key, 'divemate'))
  })

  afterAll(async () => {
    await closeDb()
  })

  test('switched-off entities are neither created nor updated, and references survive', async () => {
    const first = await importSnapshot(snapshot({}))
    expect(first.records.created).toBe(5)
    expect(await getDb().select().from(certifications)).toHaveLength(1)
    expect(await getDb().select().from(diveProfileSamples)).toHaveLength(3)
    const imported = await currentDive()
    expect(imported.siteId).not.toBeNull()

    // Certifications and buddies off: the changed certification is left alone,
    // the changed dive still applies and keeps its site and its known buddy,
    // and the newly named person is not created.
    await saveIntegrationEntitySelection('divemate', ['certifications', 'buddies'])
    const second = await importSnapshot(
      snapshot({
        certifications: [certification('Advanced')],
        buddies: [buddy('4', 'Sam'), buddy('5', 'Newcomer')],
        dives: [dive('second', 'Someone New')],
      }),
    )
    expect(second.diagnostics).toMatchObject({
      disabledEntities: ['buddies', 'certifications'],
      recordsSkippedByEntity: 3,
    })
    const [certificate] = await getDb().select().from(certifications)
    expect(certificate?.name).toBe('Open Water')
    const afterSecond = await currentDive()
    expect(afterSecond.notes).toBe('second')
    expect(afterSecond.siteId).toBe(imported.siteId)
    const people = await getDb().select({ firstName: buddies.firstName }).from(buddies)
    expect(people.map((person) => person.firstName).sort()).toEqual(['Sam'])
    expect(await getDb().select().from(diveBuddies)).toHaveLength(1)

    // Profiles off: the dive still updates, but its samples are kept rather
    // than replaced with nothing.
    await saveIntegrationEntitySelection('divemate', ['profile_samples'])
    await importSnapshot(snapshot({ dives: [dive('third', null)], profileSamples: [] }))
    expect((await currentDive()).notes).toBe('third')
    expect(await getDb().select().from(diveProfileSamples)).toHaveLength(3)

    // Dives off takes tanks and profiles with it: nothing about the dive moves.
    await saveIntegrationEntitySelection('divemate', ['dives'])
    const fourth = await importSnapshot(
      snapshot({ dives: [dive('fourth', null)], tanks: [tank('180')] }),
    )
    expect(fourth.diagnostics).toMatchObject({
      disabledEntities: ['dives', 'profile_samples', 'tanks'],
    })
    expect((await currentDive()).notes).toBe('third')
    const [cylinder] = await getDb().select().from(tanks)
    expect(cylinder?.startPressureBar).toBe('200.00')

    // Everything back on: the held-back changes come across as new or updated.
    await saveIntegrationEntitySelection('divemate', [])
    const fifth = await importSnapshot(
      snapshot({
        certifications: [certification('Advanced')],
        buddies: [buddy('4', 'Sam'), buddy('5', 'Newcomer')],
        dives: [dive('fifth', null)],
        tanks: [tank('180')],
      }),
    )
    expect(fifth.diagnostics).not.toHaveProperty('disabledEntities')
    expect((await getDb().select().from(certifications))[0]?.name).toBe('Advanced')
    expect((await getDb().select().from(tanks))[0]?.startPressureBar).toBe('180.00')
    expect((await getDb().select().from(buddies)).map((p) => p.firstName).sort()).toEqual(
      ['Newcomer', 'Sam'],
    )

    // A canonical row exported to DiveMate comes back with its UUID. Its new
    // numeric source ID must attach to that row rather than create a copy.
    const [manualDive] = await getDb()
      .insert(dives)
      .values({
        captureSource: 'manual',
        diveDate: '2026-09-02',
        notes: 'created in Divetracx',
      })
      .returning({ id: dives.id })
    if (!manualDive) throw new Error('Could not create the round-trip fixture')
    const roundTrippedDive = {
      ...dive('created in Divetracx', null),
      ...source('12', {
        UUID: manualDive.id,
        Comments: 'created in Divetracx',
      }),
      captureSource: 'manual' as const,
      diveDate: '2026-09-02',
    }
    await importSnapshot(snapshot({ dives: [dive('fifth', null), roundTrippedDive] }))
    expect(await getDb().select().from(dives)).toHaveLength(2)
    const [roundTripLink] = await getDb()
      .select({
        canonicalEntityId: externalRecordLinks.canonicalEntityId,
        role: externalRecordLinks.role,
      })
      .from(externalRecords)
      .innerJoin(
        externalRecordLinks,
        eq(externalRecordLinks.externalRecordId, externalRecords.id),
      )
      .where(
        and(
          eq(externalRecords.integrationKey, 'divemate'),
          eq(externalRecords.entityType, 'dive'),
          eq(externalRecords.identityKey, '12'),
          eq(externalRecordLinks.canonicalEntityType, 'dive'),
        ),
      )
    expect(roundTripLink).toEqual({
      canonicalEntityId: manualDive.id,
      role: 'matched',
    })

    // Repair data created before identity preservation shipped. The shuffled
    // source row points at a generated canonical copy and a later write-back
    // has already replaced its UUID too. The next ordinary incremental sync
    // uses the integration-owned natural key to remove only that copy and
    // reattach its provenance and relationships.
    const original = await currentDive()
    const [originalSite] = await getDb().select().from(diveSites)
    if (!originalSite) throw new Error('The fixture site is missing')
    const [duplicateSite] = await getDb()
      .insert(diveSites)
      .values({ name: originalSite.name })
      .returning({ id: diveSites.id })
    const [duplicateDive] = await getDb()
      .insert(dives)
      .values({
        captureSource: original.captureSource,
        diveDate: original.diveDate,
        siteId: duplicateSite?.id,
        number: original.number,
        durationSeconds: original.durationSeconds,
      })
      .returning({ id: dives.id })
    if (!duplicateSite || !duplicateDive) throw new Error('Could not create copies')
    const staleRecords = await getDb()
      .insert(externalRecords)
      .values([
        {
          integrationKey: 'divemate',
          entityType: 'dive_site',
          identityKey: '70',
          externalId: '70',
          rawPayload: { ID: 70, UUID: duplicateSite.id, Place: originalSite.name },
          contentHash: 'stale-site',
        },
        {
          integrationKey: 'divemate',
          entityType: 'dive',
          identityKey: '99',
          externalId: '99',
          rawPayload: { ID: 99, UUID: duplicateDive.id, Comments: original.notes },
          contentHash: 'stale-dive',
        },
      ])
      .returning({ id: externalRecords.id, entityType: externalRecords.entityType })
    await getDb()
      .insert(externalRecordLinks)
      .values(
        staleRecords.map((record) => ({
          externalRecordId: record.id,
          canonicalEntityType: record.entityType,
          canonicalEntityId:
            record.entityType === 'dive' ? duplicateDive.id : duplicateSite.id,
        })),
      )

    const shuffledDive = {
      ...dive(original.notes ?? '', null),
      ...source('99', { UUID: duplicateDive.id, Comments: original.notes }),
      siteExternalId: '70',
    }
    const shuffledSite = {
      ...site(originalSite.name),
      ...source('70', { UUID: duplicateSite.id, Place: originalSite.name }),
    }
    const repaired = await importSnapshot(
      snapshot({
        sites: [site(originalSite.name), shuffledSite],
        dives: [dive(original.notes ?? '', null), shuffledDive],
        tanks: [],
        profileSamples: [],
      }),
    )
    expect(repaired.diagnostics).toMatchObject({
      canonical: { byEntity: { roundTripDuplicatesRemoved: 2 } },
    })
    expect(await getDb().select().from(dives)).toHaveLength(2)
    expect(await getDb().select().from(diveSites)).toHaveLength(1)
    const repairedDive = await currentDive()
    expect(repairedDive.id).toBe(original.id)
    expect(repairedDive.siteId).toBe(originalSite.id)
  })
})
