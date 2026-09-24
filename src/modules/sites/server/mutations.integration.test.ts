import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  diveSites,
  externalRecordLinks,
  externalRecords,
  integrations,
} from '@/db/schema'
import { deleteSite, saveSite } from './mutations.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-site-mutations'

describe.skipIf(!enabled)('manual site mutations database contract', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(externalRecords)
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
    await db.delete(diveSites)
  })

  afterAll(async () => {
    await closeDb()
  })

  test('creates, validates, updates, and deletes a site after removing its provenance', async () => {
    const db = getDb()

    await expect(saveSite('new', {})).rejects.toThrow('Name is required')

    const siteId = await saveSite('new', {
      name: 'Blue Hole',
      country: 'Belize',
      latitude: 17.3,
      longitude: -87.5,
      maximumDepthMeters: 124,
      rating: 5,
    })
    let [site] = await db.select().from(diveSites).where(eq(diveSites.id, siteId))
    expect(site).toMatchObject({
      name: 'Blue Hole',
      country: 'Belize',
      latitude: '17.3000000',
      rating: 5,
    })

    // A partial update touches only the given field.
    await saveSite(siteId, { name: 'Great Blue Hole' })
    ;[site] = await db.select().from(diveSites).where(eq(diveSites.id, siteId))
    expect(site?.name).toBe('Great Blue Hole')
    expect(site?.country).toBe('Belize')

    await db.insert(integrations).values({
      key: INTEGRATION_KEY,
      displayName: 'Test site mutation integration',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['sites'],
    })
    const [externalRecord] = await db
      .insert(externalRecords)
      .values({
        integrationKey: INTEGRATION_KEY,
        entityType: 'site',
        identityKey: 'site-1',
        rawPayload: {},
        contentHash: 'hash-site',
      })
      .returning({ id: externalRecords.id })
    if (!externalRecord) throw new Error('Seed external record was not created')
    await db.insert(externalRecordLinks).values({
      externalRecordId: externalRecord.id,
      canonicalEntityType: 'dive_site',
      canonicalEntityId: siteId,
      role: 'produced',
    })

    await deleteSite(siteId)

    expect(
      await db.select().from(diveSites).where(eq(diveSites.id, siteId)),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(externalRecordLinks)
        .where(eq(externalRecordLinks.externalRecordId, externalRecord.id)),
    ).toHaveLength(0)
    await expect(deleteSite(siteId)).rejects.toThrow('The record was not found')
  })
})
