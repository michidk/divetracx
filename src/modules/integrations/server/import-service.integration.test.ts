import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { desc, eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  dives,
  externalRecordLinks,
  externalRecords,
  importRuns,
  integrationState,
  integrations,
} from '@/db/schema'
import { mergeDivesInto } from '@/modules/dives/server/merge.server'
import type { ExternalRecordInput, IntegrationConnector } from '../types'
import { MATCHED_LINK_ROLE } from '../types'
import {
  expireTimedOutImportRuns,
  ImportAlreadyRunningError,
  performFullImport,
  performIncrementalImport,
} from './import-service.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-import'

interface TestBatch {
  records: ExternalRecordInput[]
  cursor: string
  failApply?: boolean
  failPrepare?: boolean
  prepareStarted?: () => void
  waitForPrepare?: (signal: AbortSignal) => Promise<void>
}

let batch: TestBatch = { records: [], cursor: '0' }

const connector: IntegrationConnector = {
  descriptor: {
    key: INTEGRATION_KEY,
    displayName: 'Test import',
    capabilities: { fullImport: true, incrementalImport: true, export: false },
    supportedEntities: ['dives'],
  },
  async prepareImport(context) {
    batch.prepareStarted?.()
    await batch.waitForPrepare?.(context.signal)
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
      const link = record.canonicalLinks.find(
        (candidate) => candidate.canonicalEntityType === 'dive',
      )
      // A matched dive belongs to the logbook, not to this feed: it is only
      // ever enriched, exactly as the real connectors treat one.
      if (link?.role === MATCHED_LINK_ROLE) {
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

  test('keeps a merged dive syncing without undoing the merge', async () => {
    await getDb().delete(dives)
    await getDb()
      .delete(externalRecords)
      .where(eq(externalRecords.integrationKey, INTEGRATION_KEY))

    batch = {
      records: [diveRecord('split-a', 28), diveRecord('split-b', 12)],
      cursor: 'merge-1',
    }
    await performIncrementalImport(connector, { trigger: 'manual' })
    const imported = await getDb()
      .select({ id: dives.id, maximumDepthMeters: dives.maximumDepthMeters })
      .from(dives)
      .orderBy(desc(dives.maximumDepthMeters))
    const keeper = imported[0]
    const absorbed = imported[1]
    if (!keeper || !absorbed) throw new Error('The import did not produce two dives')

    await mergeDivesInto(keeper.id, [absorbed.id])
    expect(await getDb().select().from(dives)).toHaveLength(1)

    // The absorbed dive's record now matches the keeper, so re-running the
    // import does not bring it back.
    batch = {
      records: [diveRecord('split-a', 28), diveRecord('split-b', 12)],
      cursor: 'merge-2',
    }
    await performIncrementalImport(connector, { trigger: 'manual' })
    expect(await getDb().select().from(dives)).toHaveLength(1)

    // The keeper is still an ordinary imported dive: an upstream edit reaches
    // it, and the dive it absorbed is still not recreated.
    batch = {
      records: [diveRecord('split-a', 28, 'edited upstream'), diveRecord('split-b', 12)],
      cursor: 'merge-3',
    }
    await performIncrementalImport(connector, { trigger: 'manual' })
    const afterEdit = await getDb().select().from(dives)
    expect(afterEdit).toHaveLength(1)
    expect(afterEdit[0]?.id).toBe(keeper.id)
    expect(afterEdit[0]?.notes).toBe('edited upstream')

    // Both records point at the merged dive, one as its own and one as matched.
    const provenance = await getDb()
      .select({
        identityKey: externalRecords.identityKey,
        diveId: externalRecordLinks.canonicalEntityId,
        role: externalRecordLinks.role,
      })
      .from(externalRecordLinks)
      .innerJoin(
        externalRecords,
        eq(externalRecordLinks.externalRecordId, externalRecords.id),
      )
      .where(eq(externalRecords.entityType, 'dive'))
    expect(provenance).toHaveLength(2)
    expect(provenance.every((item) => item.diveId === keeper.id)).toBe(true)
    expect(provenance.map((item) => item.role).sort()).toEqual([
      MATCHED_LINK_ROLE,
      'produced',
    ])
  })

  test('allows only one import job to run at a time', async () => {
    let notifyStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve
    })
    let unblockPrepare: (() => void) | undefined
    const blocked = new Promise<void>((resolve) => {
      unblockPrepare = resolve
    })
    batch = {
      records: [],
      cursor: 'concurrency',
      prepareStarted: () => notifyStarted?.(),
      waitForPrepare: () => blocked,
    }

    const first = performIncrementalImport(connector, { trigger: 'manual' })
    await started
    await expect(
      performIncrementalImport(connector, { trigger: 'schedule' }),
    ).rejects.toBeInstanceOf(ImportAlreadyRunningError)
    unblockPrepare?.()
    await expect(first).resolves.toMatchObject({ status: 'succeeded' })
  })

  test('aborts and records imports that exceed the overall deadline', async () => {
    const originalTimeout = process.env.IMPORT_TIMEOUT_MS
    process.env.IMPORT_TIMEOUT_MS = '200'
    batch = {
      records: [],
      cursor: 'timeout',
      waitForPrepare: (signal) =>
        new Promise((_, reject) => {
          signal.throwIfAborted()
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    }

    try {
      await expect(
        performIncrementalImport(connector, { trigger: 'manual' }),
      ).rejects.toThrow('Synchronization timed out after 200ms')
      const [latest] = await getDb()
        .select({ status: importRuns.status, error: importRuns.error })
        .from(importRuns)
        .where(eq(importRuns.integrationKey, INTEGRATION_KEY))
        .orderBy(desc(importRuns.startedAt))
        .limit(1)
      expect(latest).toEqual({
        status: 'failed',
        error: 'Synchronization timed out after 200ms',
      })
    } finally {
      if (originalTimeout === undefined) delete process.env.IMPORT_TIMEOUT_MS
      else process.env.IMPORT_TIMEOUT_MS = originalTimeout
    }
  })

  test('marks abandoned running entries as timed out', async () => {
    const now = new Date()
    const [abandoned] = await getDb()
      .insert(importRuns)
      .values({
        integrationKey: INTEGRATION_KEY,
        mode: 'incremental',
        trigger: 'schedule',
        status: 'running',
        startedAt: new Date(now.getTime() - 1_000),
      })
      .returning({ id: importRuns.id })
    if (!abandoned) throw new Error('Could not create abandoned test run')

    await expireTimedOutImportRuns(500, now)

    const [expired] = await getDb()
      .select({ status: importRuns.status, error: importRuns.error })
      .from(importRuns)
      .where(eq(importRuns.id, abandoned.id))
    expect(expired).toEqual({
      status: 'failed',
      error: 'Synchronization timed out after 500ms',
    })
  })
})
