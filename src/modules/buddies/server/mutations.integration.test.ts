import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { buddies, externalRecordLinks, externalRecords, integrations } from '@/db/schema'
import { deleteBuddy, saveBuddy } from './mutations.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-buddy-mutations'

describe.skipIf(!enabled)('manual buddy mutations database contract', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(externalRecords)
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
    await db.delete(buddies)
  })

  afterAll(async () => {
    await closeDb()
  })

  test('saves emergency contact fields — the exact fields MCP was previously missing', async () => {
    const buddyId = await saveBuddy('new', {
      firstName: 'Sam',
      lastName: 'Diver',
      emergencyContact: 'Jo Diver',
      emergencyPhone: '+1-555-0100',
      emergencyEmail: 'jo@example.com',
      instructor: true,
    })
    const [buddy] = await getDb().select().from(buddies).where(eq(buddies.id, buddyId))
    expect(buddy).toMatchObject({
      firstName: 'Sam',
      emergencyContact: 'Jo Diver',
      emergencyPhone: '+1-555-0100',
      emergencyEmail: 'jo@example.com',
      instructor: true,
    })
  })

  test('updates only the given field, deletes after removing provenance, and rejects a missing buddy', async () => {
    const db = getDb()
    const buddyId = await saveBuddy('new', { firstName: 'Original', city: 'Cairns' })

    await saveBuddy(buddyId, { firstName: 'Updated' })
    const [buddy] = await db.select().from(buddies).where(eq(buddies.id, buddyId))
    expect(buddy?.firstName).toBe('Updated')
    expect(buddy?.city).toBe('Cairns')

    await db.insert(integrations).values({
      key: INTEGRATION_KEY,
      displayName: 'Test buddy mutation integration',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['buddies'],
    })
    const [externalRecord] = await db
      .insert(externalRecords)
      .values({
        integrationKey: INTEGRATION_KEY,
        entityType: 'buddy',
        identityKey: 'buddy-1',
        rawPayload: {},
        contentHash: 'hash-buddy',
      })
      .returning({ id: externalRecords.id })
    if (!externalRecord) throw new Error('Seed external record was not created')
    await db.insert(externalRecordLinks).values({
      externalRecordId: externalRecord.id,
      canonicalEntityType: 'buddy',
      canonicalEntityId: buddyId,
      role: 'produced',
    })

    await deleteBuddy(buddyId)

    expect(await db.select().from(buddies).where(eq(buddies.id, buddyId))).toHaveLength(0)
    expect(
      await db
        .select()
        .from(externalRecordLinks)
        .where(eq(externalRecordLinks.externalRecordId, externalRecord.id)),
    ).toHaveLength(0)
    await expect(deleteBuddy(buddyId)).rejects.toThrow('The record was not found')
  })
})
