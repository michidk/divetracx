import '@tanstack/react-start/server-only'

import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { getDb, tryAcquireDbAdvisoryLock } from '@/db'
import {
  externalRecordLinks,
  importRuns,
  integrationState,
  integrations,
} from '@/db/schema'
import { getServerEnv } from '@/env'
import { externalRecordKey } from '../record-classification'
import type {
  ApplyImportContext,
  ImportMode,
  ImportResult,
  IntegrationConnector,
  PerformImportOptions,
} from '../types'
import {
  markExternalRecordsProcessed,
  observeExternalRecords,
  replaceImportedCanonicalDataset,
} from './import-repository.server'

const IMPORT_LOCK_KEY = 'divetracx:import'

export class ImportAlreadyRunningError extends Error {
  constructor() {
    super('Another synchronization job is already running')
    this.name = 'ImportAlreadyRunningError'
  }
}

function formatDuration(milliseconds: number) {
  if (milliseconds % 60_000 === 0) {
    const minutes = milliseconds / 60_000
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }
  if (milliseconds % 1_000 === 0) {
    const seconds = milliseconds / 1_000
    return `${seconds} second${seconds === 1 ? '' : 's'}`
  }
  return `${milliseconds}ms`
}

function timeoutError(timeoutMs: number) {
  return new Error(`Synchronization timed out after ${formatDuration(timeoutMs)}`)
}

function importFailure(
  error: unknown,
  signal: AbortSignal,
  deadlineAt: number,
  timeoutMs: number,
) {
  if (signal.aborted) return signal.reason
  if (
    Date.now() >= deadlineAt ||
    (error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '57014')
  ) {
    return timeoutError(timeoutMs)
  }
  return error
}

async function withImportLock<T>(action: () => Promise<T>): Promise<T> {
  const release = await tryAcquireDbAdvisoryLock(IMPORT_LOCK_KEY)
  if (!release) throw new ImportAlreadyRunningError()
  try {
    return await action()
  } finally {
    await release()
  }
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown import error'
  return message.slice(0, 4_000)
}

async function ensureIntegration(connector: IntegrationConnector<unknown>) {
  const descriptor = connector.descriptor
  await getDb()
    .insert(integrations)
    .values({
      key: descriptor.key,
      displayName: descriptor.displayName,
      capabilities: descriptor.capabilities,
      supportedEntities: descriptor.supportedEntities,
    })
    .onConflictDoUpdate({
      target: integrations.key,
      set: {
        displayName: descriptor.displayName,
        capabilities: descriptor.capabilities,
        supportedEntities: descriptor.supportedEntities,
        updatedAt: new Date(),
      },
    })
}

function assertSupported(
  connector: IntegrationConnector<unknown>,
  mode: ImportMode,
  options: PerformImportOptions,
) {
  const capabilities = connector.descriptor.capabilities
  if (mode === 'full' && !capabilities.fullImport) {
    throw new Error(`${connector.descriptor.displayName} does not support full import`)
  }
  if (mode === 'incremental' && !capabilities.incrementalImport) {
    throw new Error(
      `${connector.descriptor.displayName} does not support incremental import`,
    )
  }
  if (mode === 'full' && options.trigger !== 'manual') {
    throw new Error('Full imports must be initiated manually')
  }
}

async function performLockedImport<TData>(
  connector: IntegrationConnector<TData>,
  mode: ImportMode,
  options: PerformImportOptions,
  signal: AbortSignal,
  deadlineAt: number,
  timeoutMs: number,
): Promise<ImportResult> {
  signal.throwIfAborted()
  await expireTimedOutImportRuns(timeoutMs)
  signal.throwIfAborted()
  await ensureIntegration(connector)
  signal.throwIfAborted()
  const db = getDb()
  const [run] = await db
    .insert(importRuns)
    .values({
      integrationKey: connector.descriptor.key,
      mode,
      trigger: options.trigger,
      status: 'running',
    })
    .returning({ id: importRuns.id })
  if (!run) throw new Error('Could not create the import run')

  let discovered = 0
  try {
    signal.throwIfAborted()
    const [storedState] = await db
      .select({ state: integrationState.state })
      .from(integrationState)
      .where(eq(integrationState.integrationKey, connector.descriptor.key))
      .limit(1)
    signal.throwIfAborted()
    const prepared = await connector.prepareImport({
      mode,
      state: storedState?.state ?? {},
      signal,
    })
    signal.throwIfAborted()
    discovered = prepared.records.length
    if (!prepared.validation.complete) {
      throw new Error(
        `${prepared.validation.sourceDescription} was not validated as a complete import source`,
      )
    }

    const result = await db.transaction(async (transaction) => {
      signal.throwIfAborted()
      const remainingMs = Math.max(1, deadlineAt - Date.now())
      await transaction.execute(
        sql`select set_config('statement_timeout', ${`${remainingMs}ms`}, true)`,
      )
      if (mode === 'full') {
        await replaceImportedCanonicalDataset(transaction, signal)
      }
      const observed = await observeExternalRecords(
        transaction,
        connector.descriptor.key,
        run.id,
        prepared.records,
        signal,
      )
      const recordByKey = new Map(
        observed.map((record) => [
          externalRecordKey(record.input.entityType, record.input.identityKey),
          record,
        ]),
      )
      const findRecord: ApplyImportContext<TData>['findRecord'] = (
        entityType,
        identityKey,
      ) => {
        const record = recordByKey.get(externalRecordKey(entityType, identityKey))
        if (!record) {
          throw new Error(`Missing prepared external record ${entityType}:${identityKey}`)
        }
        return record
      }
      const findCanonicalId: ApplyImportContext<TData>['findCanonicalId'] = (
        entityType,
        identityKey,
        canonicalEntityType,
      ) =>
        findRecord(entityType, identityKey).canonicalLinks.find(
          (link) => link.canonicalEntityType === canonicalEntityType,
        )?.canonicalEntityId ?? null
      const linkCanonicalRecord: ApplyImportContext<TData>['linkCanonicalRecord'] =
        async (
          externalRecordId,
          canonicalEntityType,
          canonicalEntityId,
          role = 'produced',
        ) => {
          signal.throwIfAborted()
          await transaction
            .insert(externalRecordLinks)
            .values({ externalRecordId, canonicalEntityType, canonicalEntityId, role })
            .onConflictDoNothing()
          const record = observed.find((candidate) => candidate.id === externalRecordId)
          if (
            record &&
            !record.canonicalLinks.some(
              (link) =>
                link.canonicalEntityType === canonicalEntityType &&
                link.canonicalEntityId === canonicalEntityId,
            )
          ) {
            record.canonicalLinks.push({ canonicalEntityType, canonicalEntityId, role })
          }
        }
      const unlinkCanonicalRecords: ApplyImportContext<TData>['unlinkCanonicalRecords'] =
        async (externalRecordId, canonicalEntityTypes) => {
          signal.throwIfAborted()
          if (canonicalEntityTypes.length === 0) return
          await transaction
            .delete(externalRecordLinks)
            .where(
              and(
                eq(externalRecordLinks.externalRecordId, externalRecordId),
                inArray(externalRecordLinks.canonicalEntityType, canonicalEntityTypes),
              ),
            )
          const record = observed.find((candidate) => candidate.id === externalRecordId)
          if (record) {
            record.canonicalLinks = record.canonicalLinks.filter(
              (link) => !canonicalEntityTypes.includes(link.canonicalEntityType),
            )
          }
        }
      const canonical = await connector.applyImport({
        transaction,
        mode,
        runId: run.id,
        signal,
        prepared,
        records: observed,
        findRecord,
        findCanonicalId,
        linkCanonicalRecord,
        unlinkCanonicalRecords,
      })
      signal.throwIfAborted()
      await markExternalRecordsProcessed(transaction, observed, signal)

      const created = observed.filter((record) => record.change === 'created').length
      const updated = observed.filter((record) => record.change === 'updated').length
      const skipped = observed.filter((record) => record.change === 'unchanged').length
      const diagnostics = {
        ...(prepared.diagnostics ?? {}),
        source: prepared.validation.sourceDescription,
        canonical: {
          created: canonical.created,
          updated: canonical.updated,
          skipped: canonical.skipped,
          ...(canonical.byEntity ? { byEntity: canonical.byEntity } : {}),
        },
      }
      const finishedAt = new Date()
      signal.throwIfAborted()
      await transaction
        .insert(integrationState)
        .values({
          integrationKey: connector.descriptor.key,
          state: prepared.nextState,
          lastSuccessfulRunId: run.id,
          updatedAt: finishedAt,
        })
        .onConflictDoUpdate({
          target: integrationState.integrationKey,
          set: {
            state: prepared.nextState,
            lastSuccessfulRunId: run.id,
            updatedAt: finishedAt,
          },
        })
      await transaction
        .update(importRuns)
        .set({
          status: 'succeeded',
          finishedAt,
          recordsDiscovered: observed.length,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          recordsFailed: 0,
          sourceFingerprint: prepared.sourceFingerprint ?? null,
          diagnostics,
          error: null,
        })
        .where(eq(importRuns.id, run.id))

      return {
        runId: run.id,
        integrationKey: connector.descriptor.key,
        mode,
        status: 'succeeded' as const,
        sourceFingerprint: prepared.sourceFingerprint ?? null,
        records: {
          discovered: observed.length,
          created,
          updated,
          skipped,
          failed: 0,
        },
        canonical,
        diagnostics,
      }
    })
    return result
  } catch (error) {
    const reportedError = importFailure(error, signal, deadlineAt, timeoutMs)
    await db
      .update(importRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        recordsDiscovered: discovered,
        recordsFailed: 1,
        error: safeError(reportedError),
      })
      .where(eq(importRuns.id, run.id))
      .catch(() => undefined)
    throw reportedError
  }
}

export async function expireTimedOutImportRuns(
  timeoutMs = getServerEnv().IMPORT_TIMEOUT_MS,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - timeoutMs)
  await getDb()
    .update(importRuns)
    .set({
      status: 'failed',
      finishedAt: now,
      recordsFailed: 1,
      error: safeError(timeoutError(timeoutMs)),
    })
    .where(and(eq(importRuns.status, 'running'), lt(importRuns.startedAt, cutoff)))
}

export async function performImport<TData>(
  connector: IntegrationConnector<TData>,
  mode: ImportMode,
  options: PerformImportOptions,
): Promise<ImportResult> {
  assertSupported(connector, mode, options)
  return withImportLock(async () => {
    const timeoutMs = getServerEnv().IMPORT_TIMEOUT_MS
    const controller = new AbortController()
    const deadlineAt = Date.now() + timeoutMs
    const timer = setTimeout(() => controller.abort(timeoutError(timeoutMs)), timeoutMs)
    try {
      return await performLockedImport(
        connector,
        mode,
        options,
        controller.signal,
        deadlineAt,
        timeoutMs,
      )
    } finally {
      clearTimeout(timer)
    }
  })
}

export function performFullImport<TData>(
  connector: IntegrationConnector<TData>,
  options: PerformImportOptions = { trigger: 'manual' },
) {
  return performImport(connector, 'full', options)
}

export function performIncrementalImport<TData>(
  connector: IntegrationConnector<TData>,
  options: PerformImportOptions,
) {
  return performImport(connector, 'incremental', options)
}
