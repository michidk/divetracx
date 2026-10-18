import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { inArray } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { dives } from '@/db/schema'
import { loadDive } from './queries.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'

describe.skipIf(!enabled)('adjacent dives', () => {
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
  ] as const

  beforeAll(async () => {
    await getDb().delete(dives)
    await getDb()
      .insert(dives)
      .values([
        { id: ids[2], diveDate: '2026-10-02', entryTime: '09:00', number: 3 },
        { id: ids[1], diveDate: '2026-10-01', entryTime: '10:00', number: 2 },
        { id: ids[0], diveDate: '2026-10-01', entryTime: '09:00', number: 1 },
      ])
  })

  afterAll(async () => {
    await getDb().delete(dives).where(inArray(dives.id, ids))
    await closeDb()
  })

  test('walks chronologically and stops at either end', async () => {
    expect(await loadDive(ids[0])).toMatchObject({
      previousDive: null,
      nextDive: { id: ids[1], number: 2 },
    })
    expect(await loadDive(ids[1])).toMatchObject({
      previousDive: { id: ids[0], number: 1 },
      nextDive: { id: ids[2], number: 3 },
    })
    expect(await loadDive(ids[2])).toMatchObject({
      previousDive: { id: ids[1], number: 2 },
      nextDive: null,
    })
    expect(await loadDive('00000000-0000-4000-8000-000000000099')).toBeNull()
  })
})
