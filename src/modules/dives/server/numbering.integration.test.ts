import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { asc } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { dives, logbookSettings } from '@/db/schema'
import { loadDiveEditor } from './editor.server'
import { savePriorDiveCount } from './logbook-settings.server'
import { loadNumberingStatus, renumberDivesByDate } from './maintenance.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'

describe.skipIf(!enabled)('dive numbering after prior unlogged dives', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(dives)
    await db.delete(logbookSettings)
  })

  afterAll(async () => {
    await getDb().delete(logbookSettings)
    await closeDb()
  })

  test('the first logged dive follows the prior dive count', async () => {
    expect((await loadDiveEditor(null))?.nextNumber).toBe(1)

    await savePriorDiveCount(20)

    expect((await loadDiveEditor(null))?.nextNumber).toBe(21)
  })

  test('renumbering by date continues after the prior dive count', async () => {
    const db = getDb()
    await db.insert(dives).values([
      { number: 1, diveDate: '2026-03-02', captureSource: 'manual' },
      { number: 2, diveDate: '2026-03-01', captureSource: 'manual' },
      { number: null, diveDate: '2026-03-03', captureSource: 'manual' },
    ])

    const before = await loadNumberingStatus()
    expect(before).toMatchObject({ priorDiveCount: 20, totalDives: 3, wouldChange: 3 })

    expect(await renumberDivesByDate()).toEqual({ changed: 3 })
    const numbered = await db
      .select({ number: dives.number, diveDate: dives.diveDate })
      .from(dives)
      .orderBy(asc(dives.diveDate))
    expect(numbered).toEqual([
      { number: 21, diveDate: '2026-03-01' },
      { number: 22, diveDate: '2026-03-02' },
      { number: 23, diveDate: '2026-03-03' },
    ])
    expect((await loadNumberingStatus()).wouldChange).toBe(0)
    expect((await loadDiveEditor(null))?.nextNumber).toBe(24)
  })
})
