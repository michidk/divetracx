import '@tanstack/react-start/server-only'

import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { importRuns, integrationState, integrations } from '@/db/schema'
import { getServerEnv } from '@/env'
import { getIntegrationConnector, listIntegrationConnectors } from '../registry.server'
import type { ImportMode, ImportTrigger } from '../types'
import { performFullImport, performIncrementalImport } from './import-service.server'

export async function loadIntegrationStatus() {
  const environment = getServerEnv()
  return Promise.all(
    listIntegrationConnectors().map(async (connector) => {
      const [latestRun, storedState] = await Promise.all([
        getDb()
          .select({
            id: importRuns.id,
            mode: importRuns.mode,
            trigger: importRuns.trigger,
            status: importRuns.status,
            startedAt: importRuns.startedAt,
            finishedAt: importRuns.finishedAt,
            recordsDiscovered: importRuns.recordsDiscovered,
            recordsCreated: importRuns.recordsCreated,
            recordsUpdated: importRuns.recordsUpdated,
            recordsSkipped: importRuns.recordsSkipped,
            recordsFailed: importRuns.recordsFailed,
            error: importRuns.error,
          })
          .from(importRuns)
          .where(eq(importRuns.integrationKey, connector.descriptor.key))
          .orderBy(desc(importRuns.startedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        getDb()
          .select({ updatedAt: integrationState.updatedAt })
          .from(integrationState)
          .where(eq(integrationState.integrationKey, connector.descriptor.key))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ])
      const configured =
        connector.descriptor.key === 'divemate'
          ? {
              fullImport: Boolean(environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID),
              incrementalImport: Boolean(environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID),
              export: Boolean(environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID),
            }
          : {
              fullImport: Boolean(environment.GARMIN_ADAPTER_FULL_IMPORT_URL),
              incrementalImport: Boolean(
                environment.GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL,
              ),
              export: false,
            }
      return {
        descriptor: connector.descriptor,
        configured,
        configurationHint:
          connector.descriptor.key === 'divemate'
            ? 'Configure the Google Drive backup folder and server-side service account.'
            : 'Configure the Garmin adapter URL and shared authorization secret, then connect the Garmin Connect account below.',
        latestRun,
        stateUpdatedAt: storedState?.updatedAt ?? null,
      }
    }),
  )
}

export async function loadImportLogs() {
  return getDb()
    .select({
      id: importRuns.id,
      integrationKey: importRuns.integrationKey,
      integrationName: integrations.displayName,
      mode: importRuns.mode,
      trigger: importRuns.trigger,
      status: importRuns.status,
      startedAt: importRuns.startedAt,
      finishedAt: importRuns.finishedAt,
      recordsDiscovered: importRuns.recordsDiscovered,
      recordsCreated: importRuns.recordsCreated,
      recordsUpdated: importRuns.recordsUpdated,
      recordsSkipped: importRuns.recordsSkipped,
      recordsFailed: importRuns.recordsFailed,
      sourceFingerprint: importRuns.sourceFingerprint,
      error: importRuns.error,
    })
    .from(importRuns)
    .innerJoin(integrations, eq(importRuns.integrationKey, integrations.key))
    .orderBy(desc(importRuns.startedAt))
    .limit(50)
}

export function runIntegrationImport(
  integrationKey: string,
  mode: ImportMode,
  trigger: ImportTrigger = 'manual',
) {
  const connector = getIntegrationConnector(integrationKey)
  return mode === 'full'
    ? performFullImport(connector, { trigger })
    : performIncrementalImport(connector, { trigger })
}

export async function runIntegrationImportForUi(
  integrationKey: string,
  mode: ImportMode,
) {
  const result = await runIntegrationImport(integrationKey, mode, 'manual')
  return {
    runId: result.runId,
    integrationKey: result.integrationKey,
    mode: result.mode,
    status: result.status,
    sourceFingerprint: result.sourceFingerprint,
    records: result.records,
    canonical: {
      created: result.canonical.created,
      updated: result.canonical.updated,
      skipped: result.canonical.skipped,
      byEntity: result.canonical.byEntity ?? null,
    },
  }
}

export async function exportFromIntegration(integrationKey: string) {
  const connector = getIntegrationConnector(integrationKey)
  if (!connector.descriptor.capabilities.export || !connector.export) {
    throw new Error(`${connector.descriptor.displayName} does not support export`)
  }
  return connector.export()
}
