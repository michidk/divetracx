import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  dives,
  externalRecordLinks,
  externalRecords,
  importRuns,
  integrationState,
  integrations,
} from '@/db/schema'
import type { ExternalRecordInput, IntegrationConnector } from '../types'
import { performFullImport, performIncrementalImport } from './import-service.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-import'

interface TestBatch {
  records: ExternalRecordInput[]
  cursor: string
  failApply?: boolean
  failPrepare?: boolean
}

let batch: TestBatch = { records: [], cursor: '0' }

const connector: IntegrationConnector = {
  descriptor: {
    key: INTEGRATION_KEY,
    displayName: 'Test import',
    capabilities: { fullImport: true, incrementalImport: true, export: false },
    supportedEntities: ['dives'],
  },
  async prepareImport() {
    if (batch.failPrepare) throw new Error('synthetic prepare failure')
    return {
      records: batch.records,
      data: null,
      nextState: { cursor: batch.cursor },
      validation: { complete: true, sourceDescription: 'synthetic complete feed' },
    }
  },
  async applyImport(context) {
    if (batch.failApply) throw new Error('synthetic apply failure')
    let created = 0
    let updated = 0
    let skipped = 0
    for (const record of context.records) {
      if (record.change === 'unchanged') {
        skipped += 1
        continue
      }
      const raw = record.input.rawPayload
      const values = {
        diveDate: String(raw.diveDate),
        durationSeconds: Number(raw.durationSeconds),
        maximumDepthMeters: String(raw.maximumDepthMeters),
        notes: typeof raw.notes === 'string' ? raw.notes : null,
        updatedAt: new Date(),
      }
      const existingId = context.findCanonicalId('dive', record.input.identityKey, 'dive')
      let diveId = existingId
      if (diveId) {
        await context.transaction.update(dives).set(values).where(eq(dives.id, diveId))
        updated += 1
      } else {
        const [inserted] = await context.transaction
          .insert(dives)
          .values(values)
          .returning({ id: dives.id })
        diveId = inserted?.id ?? null
        created += 1
      }
      if (!diveId) throw new Error('Synthetic connector failed to store a dive')
      await context.linkCanonicalRecord(record.id, 'dive', diveId)
    }
    return { created, updated, skipped }
  },
}

function diveRecord(
  identityKey: string,
  maximumDepthMeters: number,
  notes?: string,
): ExternalRecordInput {
  return {
    entityType: 'dive',
    identityKey,
    externalId: identityKey,
    rawPayload: {
      diveDate: '2026-09-01',
      durationSeconds: 1_800,
      maximumDepthMeters,
      ...(notes ? { notes } : {}),
    },
  }
}

describe.skipIf(!enabled)('generic import service database contract', () => {
  beforeAll(async () => {
    const db = getDb()
    await db
      .delete(integrationState)
      .where(eq(integrationState.integrationKey, INTEGRATION_KEY))
    await db
      .delete(externalRecords)
      .where(eq(externalRecords.integrationKey, INTEGRATION_KEY))
    await db.delete(importRuns).where(eq(importRuns.integrationKey, INTEGRATION_KEY))
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
  })

  afterAll(async () => {
    await closeDb()
  })

  test('is idempotent, updates changed records, advances state only on success, and retains provenance', async () => {
    batch = { records: [diveRecord('activity-1', 18)], cursor: '1' }
    const first = await performIncrementalImport(connector, { trigger: 'manual' })
    expect(first.records).toMatchObject({ created: 1, updated: 0, skipped: 0 })

    batch = { records: [diveRecord('activity-1', 18)], cursor: '2' }
    const repeated = await performIncrementalImport(connector, { trigger: 'manual' })
    expect(repeated.records).toMatchObject({ created: 0, updated: 0, skipped: 1 })
    expect(await getDb().select().from(dives)).toHaveLength(1)

    batch = {
      records: [
        diveRecord('activity-1', 24, 'changed externally'),
        diveRecord('activity-2', 12),
      ],
      cursor: '3',
    }
    const changed = await performIncrementalImport(connector, { trigger: 'manual' })
    expect(changed.canonical).toMatchObject({ created: 1, updated: 1 })
    expect(await getDb().select().from(dives)).toHaveLength(2)

    const provenance = await getDb()
      .select({
        identityKey: externalRecords.identityKey,
        diveId: externalRecordLinks.canonicalEntityId,
      })
      .from(externalRecordLinks)
      .innerJoin(
        externalRecords,
        eq(externalRecordLinks.externalRecordId, externalRecords.id),
      )
      .where(eq(externalRecords.integrationKey, INTEGRATION_KEY))
    expect(provenance.map((item) => item.identityKey).sort()).toEqual([
      'activity-1',
      'activity-2',
    ])

    batch = {
      records: [diveRecord('activity-3', 30)],
      cursor: 'must-not-advance',
      failApply: true,
    }
    await expect(
      performIncrementalImport(connector, { trigger: 'manual' }),
    ).rejects.toThrow('synthetic apply failure')
    const [state] = await getDb()
      .select({ state: integrationState.state })
      .from(integrationState)
      .where(eq(integrationState.integrationKey, INTEGRATION_KEY))
    expect(state?.state).toEqual({ cursor: '3' })
    expect(await getDb().select().from(dives)).toHaveLength(2)
  })

  test('full import replaces imported records, preserves manual data, and is failure-safe', async () => {
    const [manual] = await getDb()
      .insert(dives)
      .values({ diveDate: '2026-08-01', durationSeconds: 600, notes: 'manual' })
      .returning({ id: dives.id })
    batch = { records: [diveRecord('replacement', 40)], cursor: 'full-1' }
    const result = await performFullImport(connector, { trigger: 'manual' })
    expect(result.mode).toBe('full')
    const afterFull = await getDb().select().from(dives)
    expect(afterFull).toHaveLength(2)
    expect(afterFull.some((dive) => dive.id === manual?.id)).toBe(true)
    expect(afterFull.some((dive) => dive.maximumDepthMeters === '40.00')).toBe(true)

    batch = {
      records: [diveRecord('broken-replacement', 99)],
      cursor: 'full-broken',
      failPrepare: true,
    }
    await expect(performFullImport(connector, { trigger: 'manual' })).rejects.toThrow(
      'synthetic prepare failure',
    )
    expect(await getDb().select().from(dives)).toEqual(afterFull)

    await expect(performFullImport(connector, { trigger: 'schedule' })).rejects.toThrow(
      'Full imports must be initiated manually',
    )
  })
})
