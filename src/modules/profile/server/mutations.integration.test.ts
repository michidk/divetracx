import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { divers } from '@/db/schema'
import { saveDiver } from './mutations.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'

describe.skipIf(!enabled)('manual diver profile mutations database contract', () => {
  beforeAll(async () => {
    await getDb().delete(divers)
  })

  afterAll(async () => {
    await closeDb()
  })

  test('saves the card-visibility flags — the exact fields MCP was previously missing', async () => {
    const db = getDb()
    const diverId = await saveDiver('new', {
      firstName: 'Jamie',
      emergencyContact: 'Alex',
      showEmergencyOnCard: false,
      showInsuranceOnCard: false,
    })
    const [diver] = await db.select().from(divers).where(eq(divers.id, diverId))
    expect(diver).toMatchObject({
      firstName: 'Jamie',
      emergencyContact: 'Alex',
      showEmergencyOnCard: false,
      showInsuranceOnCard: false,
    })

    // A partial update touches only the given field; the rest is preserved.
    await saveDiver(diverId, { showEmergencyOnCard: true })
    const [updated] = await db.select().from(divers).where(eq(divers.id, diverId))
    expect(updated?.showEmergencyOnCard).toBe(true)
    expect(updated?.firstName).toBe('Jamie')

    await expect(saveDiver('11111111-1111-4111-8111-111111111111', {})).rejects.toThrow(
      'Diver was not found',
    )
  })
})
