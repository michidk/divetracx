import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getServerEnv } from '@/env'
import { loadLinkedCanonicalRecords } from '@/modules/integrations/server/import-repository.server'
import { performIncrementalImport } from '@/modules/integrations/server/import-service.server'
import type {
  ExternalRecordInput,
  IntegrationConnector,
} from '@/modules/integrations/types'
import { MATCHED_LINK_ROLE } from '@/modules/integrations/types'
import { DIVEMATE_ENTITIES } from '../entities'
import { parseDiveMateDatabase } from '../parser'
import type { DiveMateSnapshot, DiveMateSourceRecord } from '../types'
import {
  applySnapshot,
  ensureDiveMateDiveTypes,
  type SnapshotApplyContext,
} from './apply-snapshot.server'
import { SOURCE_KEY } from './constants'
import {
  linkExportedCanonicalRecords,
  pruneDiscardedDives,
  repairRoundTripDuplicates,
} from './duplicate-repair.server'
import { openGoogleDriveBackup } from './google-drive.server'
import {
  loadGoogleDriveImages,
  type StoredDiveMateMedia,
  storeSnapshotMedia,
} from './media.server'
import { exportDiveMateBackup } from './writeback.server'

export interface DiveMateSyncResult {
  runId: string
  fingerprint: string
  databaseVersion: string | null
  counts: Record<string, number>
}

export type DiveMateSyncTrigger = 'manual' | 'schedule' | 'cli'

export interface DiveMateSyncOptions {
  trigger?: DiveMateSyncTrigger
}

interface PreparedDiveMateData {
  snapshot: DiveMateSnapshot
  storedMedia: StoredDiveMateMedia
}

function diveMateExternalRecords(
  snapshot: DiveMateSnapshot,
  storedMedia: StoredDiveMateMedia,
): ExternalRecordInput[] {
  const record = (
    entityType: string,
    source: DiveMateSourceRecord,
    fileMetadata?: Record<string, unknown> | null,
  ): ExternalRecordInput => ({
    entityType,
    identityKey: source.externalId,
    externalId: source.externalId,
    rawPayload: source.sourcePayload,
    fileMetadata,
    mapperVersion: entityType === 'dive_type' ? 4 : entityType === 'dive' ? 2 : 1,
  })
  return [
    ...snapshot.divers.map((item) => record('diver', item)),
    ...snapshot.sites.map((item) => record('dive_site', item)),
    ...snapshot.buddies.map((item) => record('buddy', item)),
    ...snapshot.equipment.map((item) =>
      record(item.isSet ? 'equipment_set' : 'equipment', item),
    ),
    ...snapshot.certifications.map((item) => {
      const scans = storedMedia.certificationScans.get(item.externalId)
      return record(
        'certification',
        item,
        scans
          ? {
              ...(scans.scan1 ? { scan1: scans.scan1 } : {}),
              ...(scans.scan2 ? { scan2: scans.scan2 } : {}),
            }
          : null,
      )
    }),
    ...snapshot.shops.map((item) => record('shop', item)),
    ...snapshot.diveTypes.map((item) => record('dive_type', item)),
    ...snapshot.dives.map((item) => record('dive', item)),
    ...snapshot.tanks.map((item) => record('tank', item)),
    ...snapshot.pictures.map((item) => {
      const stored = storedMedia.pictures.get(item.externalId)
      return record('picture', item, stored ? { ...stored } : null)
    }),
  ]
}

/**
 * Thin connector composition: acquisition (Google Drive + parsing), media
 * ingestion, round-trip reconciliation, and canonical application each live
 * in their own collaborator module; this file only sequences them within the
 * shared transaction and import contract.
 */
export const diveMateConnector: IntegrationConnector<PreparedDiveMateData> = {
  descriptor: {
    key: SOURCE_KEY,
    displayName: 'DiveMate',
    capabilities: { fullImport: true, incrementalImport: true, export: true },
    entities: DIVEMATE_ENTITIES,
  },
  async prepareImport(context) {
    const environment = getServerEnv()
    context.signal.throwIfAborted()
    if (!environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID) {
      throw new Error('DIVEMATE_GOOGLE_DRIVE_FOLDER_ID is not configured')
    }
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'divetracx-divemate-'))
    const databasePath = join(temporaryDirectory, 'DiveMate.ddb')
    try {
      const drive = await openGoogleDriveBackup(
        environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID,
        environment.DIVEMATE_MAX_BACKUP_BYTES,
        context.signal,
      )
      context.signal.throwIfAborted()
      const fingerprint = createHash('sha256').update(drive.database).digest('hex')
      await writeFile(databasePath, drive.database)
      const snapshot = await parseDiveMateDatabase(databasePath)
      context.signal.throwIfAborted()
      // Media is fetched and stored before the transaction, so skip it for
      // entities that will not be applied rather than download it for nothing.
      const mediaSnapshot = {
        ...snapshot,
        pictures: context.isEntityEnabled('pictures') ? snapshot.pictures : [],
        certifications: context.isEntityEnabled('certifications')
          ? snapshot.certifications
          : [],
      }
      const externalImages = await loadGoogleDriveImages(
        mediaSnapshot,
        drive,
        environment.DIVEMATE_MAX_IMAGE_BYTES,
        context.signal,
      )
      const storedMedia = await storeSnapshotMedia(
        mediaSnapshot,
        context.signal,
        externalImages,
      )
      context.signal.throwIfAborted()
      const requiredTables = ['DBInfo', 'Logbook']
      const missingTables = requiredTables.filter(
        (table) => !snapshot.sourceTables.includes(table),
      )
      return {
        records: diveMateExternalRecords(snapshot, storedMedia),
        data: { snapshot, storedMedia },
        nextState: {
          sourceFingerprint: fingerprint,
          databaseVersion: snapshot.databaseVersion,
          databaseProgram: snapshot.databaseProgram,
          databaseUuid: snapshot.databaseUuid,
          databaseUpdatedAt: snapshot.databaseUpdatedAt,
        },
        validation: {
          complete: missingTables.length === 0,
          sourceDescription: `DiveMate backup${
            missingTables.length > 0 ? ` missing ${missingTables.join(', ')}` : ''
          }`,
        },
        sourceFingerprint: fingerprint,
        diagnostics: {
          databaseVersion: snapshot.databaseVersion,
          databaseProgram: snapshot.databaseProgram,
          databaseUuid: snapshot.databaseUuid,
          databaseUpdatedAt: snapshot.databaseUpdatedAt,
          sourceTables: snapshot.sourceTables,
        },
      }
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  },
  async applyImport(context) {
    const roundTripDuplicatesRemoved = await repairRoundTripDuplicates(
      context.transaction,
      context.records,
      context.signal,
    )
    const discardedDivesRemoved = context.isEntityEnabled('dives')
      ? await pruneDiscardedDives(
          context.transaction,
          context.prepared.data.snapshot.discardedDiveExternalIds,
          context.signal,
        )
      : 0
    await linkExportedCanonicalRecords(
      context.transaction,
      context.records,
      context.linkCanonicalRecord,
    )
    const changedRecords = context.records.filter(
      (record) => record.change !== 'unchanged',
    )
    if (context.isEntityEnabled('dive_types')) {
      await ensureDiveMateDiveTypes(context.transaction)
    }
    const applyContext: SnapshotApplyContext = {
      signal: context.signal,
      isEntityEnabled: context.isEntityEnabled,
      previouslyLinkedIds: async (entityType, canonicalEntityType, options) => {
        const links = await loadLinkedCanonicalRecords(
          context.transaction,
          SOURCE_KEY,
          entityType,
          canonicalEntityType,
        )
        return new Map(
          links
            .filter((link) => !options?.excludeMatched || link.role !== MATCHED_LINK_ROLE)
            .map((link) => [link.identityKey, link.canonicalEntityId]),
        )
      },
      shouldApply: (entityType, externalId) =>
        context.findRecord(entityType, externalId).change !== 'unchanged',
      canonicalRole: (entityType, externalId, canonicalEntityType) =>
        context
          .findRecord(entityType, externalId)
          .canonicalLinks.find((link) => link.canonicalEntityType === canonicalEntityType)
          ?.role ?? null,
      canonicalId: context.findCanonicalId,
      canonicalIds: (entityType, externalId, canonicalEntityType) =>
        context
          .findRecord(entityType, externalId)
          .canonicalLinks.filter(
            (link) => link.canonicalEntityType === canonicalEntityType,
          )
          .map((link) => link.canonicalEntityId),
      link: async (
        entityType,
        externalId,
        canonicalEntityType,
        canonicalEntityId,
        role,
      ) =>
        context.linkCanonicalRecord(
          context.findRecord(entityType, externalId).id,
          canonicalEntityType,
          canonicalEntityId,
          role,
        ),
      unlink: (entityType, externalId, canonicalEntityTypes) =>
        context.unlinkCanonicalRecords(
          context.findRecord(entityType, externalId).id,
          canonicalEntityTypes,
        ),
    }
    const counts = await applySnapshot(
      context.transaction,
      context.prepared.data.snapshot,
      context.prepared.data.storedMedia,
      applyContext,
    )
    const byEntity: Record<string, number> = {}
    for (const record of changedRecords) {
      context.signal.throwIfAborted()
      byEntity[record.input.entityType] = (byEntity[record.input.entityType] ?? 0) + 1
    }
    byEntity.profileSamples = context.isEntityEnabled('profile_samples')
      ? context.prepared.data.snapshot.profileSamples.filter(
          (sample) =>
            context.findRecord('dive', sample.diveExternalId).change !== 'unchanged',
        ).length
      : 0
    if (discardedDivesRemoved > 0) {
      byEntity.discardedDivesRemoved = discardedDivesRemoved
    }
    if (roundTripDuplicatesRemoved > 0) {
      byEntity.roundTripDuplicatesRemoved = roundTripDuplicatesRemoved
    }
    byEntity.pictureFiles = counts.pictureFiles
    byEntity.certificationScans = counts.certificationScans
    return {
      created: changedRecords.filter((record) => record.change === 'created').length,
      updated: changedRecords.filter((record) => record.change === 'updated').length,
      skipped: context.records.length - changedRecords.length,
      byEntity,
    }
  },
  async export() {
    const file = await exportDiveMateBackup()
    return {
      body: file.bytes,
      fileName: file.fileName,
      contentType: file.contentType,
    }
  },
}

export async function syncDiveMate(
  options: DiveMateSyncOptions = {},
): Promise<DiveMateSyncResult> {
  const result = await performIncrementalImport(diveMateConnector, {
    trigger: options.trigger ?? 'cli',
  })
  return {
    runId: result.runId,
    fingerprint: result.sourceFingerprint ?? '',
    databaseVersion:
      typeof result.diagnostics.databaseVersion === 'string'
        ? result.diagnostics.databaseVersion
        : null,
    counts: result.canonical.byEntity ?? {},
  }
}
