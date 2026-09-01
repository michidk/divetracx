import '@tanstack/react-start/server-only'

import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  externalRecordLinks,
  importRuns,
  integrationState,
  integrations,
} from '@/db/schema'
import { externalRecordKey } from '../record-classification'
import type {
  ApplyImportContext,
  ImportMode,
  ImportResult,
  IntegrationConnector,
  PerformImportOptions,
} from '../types'
import {
  acquireImportLock,
  markExternalRecordsProcessed,
  observeExternalRecords,
  replaceImportedCanonicalDataset,
} from './import-repository.server'

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

export async function performImport<TData>(
  connector: IntegrationConnector<TData>,
  mode: ImportMode,
  options: PerformImportOptions,
): Promise<ImportResult> {
  assertSupported(connector, mode, options)
  await ensureIntegration(connector)
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
    const [storedState] = await db
      .select({ state: integrationState.state })
      .from(integrationState)
      .where(eq(integrationState.integrationKey, connector.descriptor.key))
      .limit(1)
    const prepared = await connector.prepareImport({
      mode,
      state: storedState?.state ?? {},
    })
    discovered = prepared.records.length
    if (!prepared.validation.complete) {
      throw new Error(
        `${prepared.validation.sourceDescription} was not validated as a complete import source`,
      )
    }

    const result = await db.transaction(async (transaction) => {
      await acquireImportLock(transaction)
      if (mode === 'full') await replaceImportedCanonicalDataset(transaction)
      const observed = await observeExternalRecords(
        transaction,
        connector.descriptor.key,
        run.id,
        prepared.records,
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
        prepared,
        records: observed,
        findRecord,
        findCanonicalId,
        linkCanonicalRecord,
        unlinkCanonicalRecords,
      })
      await markExternalRecordsProcessed(transaction, observed)

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
    await db
      .update(importRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        recordsDiscovered: discovered,
        recordsFailed: 1,
        error: safeError(error),
      })
      .where(eq(importRuns.id, run.id))
      .catch(() => undefined)
    throw error
  }
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
