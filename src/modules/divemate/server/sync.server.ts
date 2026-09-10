import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import {
  agencyMemberships,
  boats,
  buddies,
  buddyAgencyMemberships,
  buddyCertifications,
  certifications,
  diveBuddies,
  diveEquipment,
  diveEvents,
  diveProfileSamples,
  divers,
  diveSites,
  dives,
  diveTypes,
  equipment,
  equipmentSetItems,
  equipmentSets,
  externalRecordLinks,
  externalRecords,
  pictures,
  shops,
  tanks,
} from '@/db/schema'
import { getServerEnv } from '@/env'
import { createThumbnail, thumbnailPathFor } from '@/lib/server/thumbnail.server'
import { getStorage } from '@/lib/storage'
import type { StorageProvider } from '@/lib/storage/types'
import type { DiveBuddyRole } from '@/modules/dives/buddy-role'
import { loadLinkedCanonicalRecords } from '@/modules/integrations/server/import-repository.server'
import { performIncrementalImport } from '@/modules/integrations/server/import-service.server'
import type {
  ExternalRecordInput,
  IntegrationConnector,
  ObservedExternalRecord,
} from '@/modules/integrations/types'
import { MATCHED_LINK_ROLE } from '@/modules/integrations/types'
import { resolveAgencyId } from '@/modules/profile/server/agencies.server'
import { parseDiveMateDiveTeam } from '../dive-team'
import { DEFAULT_DIVEMATE_DIVE_TYPES } from '../dive-type'
import { DIVEMATE_ENTITIES } from '../entities'
import {
  cleanDiveMateInstructorName,
  formatDiveMateInstructor,
  normalizeDiveMateInstructorName,
} from '../instructor'
import { parseDiveMateDatabase } from '../parser'
import type { DiveMateSnapshot, DiveMateSourceRecord } from '../types'
import { findDriveFile, openGoogleDriveBackup } from './google-drive.server'
import { exportDiveMateBackup } from './writeback.server'

const SOURCE_KEY = 'divemate'

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

interface ExternalImages {
  pictures: Map<string, { bytes: Uint8Array; mimeType: string }>
  certificationScans: Map<
    string,
    {
      scan1?: { bytes: Uint8Array; mimeType: string }
      scan2?: { bytes: Uint8Array; mimeType: string }
    }
  >
}

interface StoredImage {
  storagePath: string
  thumbnailStoragePath: string | null
  mimeType: string
  byteSize: number
  checksum: string
}

interface StoredDiveMateMedia {
  pictures: Map<string, StoredImage>
  certificationScans: Map<string, { scan1?: StoredImage; scan2?: StoredImage }>
}

async function pruneDiscardedDives(
  transaction: DatabaseTransaction,
  discardedDiveExternalIds: string[],
  signal: AbortSignal,
) {
  if (discardedDiveExternalIds.length === 0) return 0
  const discardedIds = new Set(discardedDiveExternalIds)
  const sourceRecords = await transaction
    .select({
      id: externalRecords.id,
      entityType: externalRecords.entityType,
      identityKey: externalRecords.identityKey,
      rawPayload: externalRecords.rawPayload,
    })
    .from(externalRecords)
    .where(eq(externalRecords.integrationKey, SOURCE_KEY))
  const discardedSourceRecordIds = sourceRecords
    .filter((record) => {
      if (record.entityType === 'dive') return discardedIds.has(record.identityKey)
      if (record.entityType !== 'tank' && record.entityType !== 'picture') return false
      const diveExternalId = record.rawPayload.LogID
      return diveExternalId !== null && discardedIds.has(String(diveExternalId))
    })
    .map((record) => record.id)
  if (discardedSourceRecordIds.length === 0) return 0

  signal.throwIfAborted()
  const links = await transaction
    .select({
      canonicalEntityType: externalRecordLinks.canonicalEntityType,
      canonicalEntityId: externalRecordLinks.canonicalEntityId,
    })
    .from(externalRecordLinks)
    .where(inArray(externalRecordLinks.externalRecordId, discardedSourceRecordIds))
  const canonicalIds = (entityType: string) =>
    links
      .filter((link) => link.canonicalEntityType === entityType)
      .map((link) => link.canonicalEntityId)

  const pictureIds = canonicalIds('picture')
  if (pictureIds.length > 0)
    await transaction.delete(pictures).where(inArray(pictures.id, pictureIds))
  const sampleIds = canonicalIds('profile_sample')
  if (sampleIds.length > 0)
    await transaction
      .delete(diveProfileSamples)
      .where(inArray(diveProfileSamples.id, sampleIds))
  const tankIds = canonicalIds('tank')
  if (tankIds.length > 0)
    await transaction.delete(tanks).where(inArray(tanks.id, tankIds))
  const buddyLinkIds = canonicalIds('dive_buddy')
  if (buddyLinkIds.length > 0)
    await transaction.delete(diveBuddies).where(inArray(diveBuddies.id, buddyLinkIds))
  const equipmentLinkIds = canonicalIds('dive_equipment')
  if (equipmentLinkIds.length > 0)
    await transaction
      .delete(diveEquipment)
      .where(inArray(diveEquipment.id, equipmentLinkIds))
  const diveIds = canonicalIds('dive')
  if (diveIds.length > 0)
    await transaction.delete(dives).where(inArray(dives.id, diveIds))

  await transaction
    .delete(externalRecords)
    .where(inArray(externalRecords.id, discardedSourceRecordIds))
  return new Set(diveIds).size
}

interface SnapshotApplyContext {
  signal: AbortSignal
  isEntityEnabled(entityKey: string): boolean
  /**
   * Canonical IDs by external ID for a record type this run did not observe,
   * so dives keep pointing at sites, people, or gear imported earlier.
   */
  previouslyLinkedIds(
    entityType: string,
    canonicalEntityType: string,
    options?: { excludeMatched?: boolean },
  ): Promise<Map<string, string>>
  shouldApply(entityType: string, externalId: string): boolean
  canonicalRole(
    entityType: string,
    externalId: string,
    canonicalEntityType: string,
  ): string | null
  canonicalId(
    entityType: string,
    externalId: string,
    canonicalEntityType: string,
  ): string | null
  canonicalIds(
    entityType: string,
    externalId: string,
    canonicalEntityType: string,
  ): string[]
  link(
    entityType: string,
    externalId: string,
    canonicalEntityType: string,
    canonicalEntityId: string,
    role?: string,
  ): Promise<void>
  unlink(
    entityType: string,
    externalId: string,
    canonicalEntityTypes: string[],
  ): Promise<void>
}

const canonicalTableBySourceType = {
  diver: divers,
  dive_site: diveSites,
  buddy: buddies,
  equipment,
  equipment_set: equipmentSets,
  certification: certifications,
  shop: shops,
  dive_type: diveTypes,
  dive: dives,
  tank: tanks,
  picture: pictures,
} as const

type DirectCanonicalSourceType = keyof typeof canonicalTableBySourceType

function isDirectCanonicalSourceType(value: string): value is DirectCanonicalSourceType {
  return Object.hasOwn(canonicalTableBySourceType, value)
}

async function existingCanonicalIds(
  transaction: DatabaseTransaction,
  entityType: DirectCanonicalSourceType,
  candidateIds: string[],
) {
  if (candidateIds.length === 0) return []
  const table = canonicalTableBySourceType[entityType]
  return (
    await transaction
      .select({ id: table.id })
      .from(table)
      .where(inArray(table.id, candidateIds))
  ).map((row) => row.id)
}

/**
 * The DiveMate exporter writes the canonical UUID into the source row. A row
 * created locally has no external-record link on its first round trip, so use
 * that UUID to attach the new source identity to the row instead of importing
 * a duplicate.
 */
async function linkExportedCanonicalRecords(
  transaction: DatabaseTransaction,
  records: ObservedExternalRecord[],
  link: (
    externalRecordId: string,
    canonicalEntityType: string,
    canonicalEntityId: string,
    role?: string,
  ) => Promise<void>,
) {
  const candidatesByType = new Map<DirectCanonicalSourceType, Map<string, string[]>>()
  for (const record of records) {
    if (
      record.change !== 'created' ||
      !isDirectCanonicalSourceType(record.input.entityType)
    ) {
      continue
    }
    if (
      record.canonicalLinks.some(
        (candidate) => candidate.canonicalEntityType === record.input.entityType,
      )
    ) {
      continue
    }
    const uuid = record.input.rawPayload.UUID
    if (typeof uuid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(uuid)) continue
    const byUuid = candidatesByType.get(record.input.entityType) ?? new Map()
    byUuid.set(uuid, [...(byUuid.get(uuid) ?? []), record.id])
    candidatesByType.set(record.input.entityType, byUuid)
  }

  for (const [entityType, byUuid] of candidatesByType) {
    const candidateIds = [...byUuid.keys()]
    const existingIds = await existingCanonicalIds(transaction, entityType, candidateIds)
    for (const canonicalId of existingIds) {
      for (const externalRecordId of byUuid.get(canonicalId) ?? []) {
        await link(externalRecordId, entityType, canonicalId, MATCHED_LINK_ROLE)
      }
    }
  }
}

interface RoundTripDuplicate {
  entityType: DirectCanonicalSourceType
  externalRecordId: string
  duplicateId: string
  originalId: string
}

async function inferLegacyRoundTripDuplicates(
  transaction: DatabaseTransaction,
  records: ObservedExternalRecord[],
) {
  const linkedRecords = new Map<DirectCanonicalSourceType, Map<string, string[]>>()
  for (const record of records) {
    if (!isDirectCanonicalSourceType(record.input.entityType)) continue
    const direct = record.canonicalLinks.find(
      (link) => link.canonicalEntityType === record.input.entityType,
    )
    if (!direct) continue
    const byCanonicalId = linkedRecords.get(record.input.entityType) ?? new Map()
    byCanonicalId.set(direct.canonicalEntityId, [
      ...(byCanonicalId.get(direct.canonicalEntityId) ?? []),
      record.id,
    ])
    linkedRecords.set(record.input.entityType, byCanonicalId)
  }

  const normalize = (value: string) => value.trim().toLocaleLowerCase('en-US')
  const rowsByType = new Map<
    DirectCanonicalSourceType,
    Array<{ id: string; createdAt: Date; key: string | null }>
  >()
  rowsByType.set(
    'dive_site',
    (
      await transaction
        .select({ id: diveSites.id, createdAt: diveSites.createdAt, key: diveSites.name })
        .from(diveSites)
    ).map((row) => ({ ...row, key: normalize(row.key) })),
  )
  rowsByType.set(
    'equipment',
    (
      await transaction
        .select({ id: equipment.id, createdAt: equipment.createdAt, key: equipment.name })
        .from(equipment)
    ).map((row) => ({ ...row, key: normalize(row.key) })),
  )
  rowsByType.set(
    'equipment_set',
    (
      await transaction
        .select({
          id: equipmentSets.id,
          createdAt: equipmentSets.createdAt,
          key: equipmentSets.name,
        })
        .from(equipmentSets)
    ).map((row) => ({ ...row, key: normalize(row.key) })),
  )
  rowsByType.set(
    'certification',
    (
      await transaction
        .select({
          id: certifications.id,
          createdAt: certifications.createdAt,
          key: certifications.name,
        })
        .from(certifications)
    ).map((row) => ({ ...row, key: normalize(row.key) })),
  )
  rowsByType.set(
    'shop',
    (
      await transaction
        .select({ id: shops.id, createdAt: shops.createdAt, key: shops.name })
        .from(shops)
    ).map((row) => ({ ...row, key: normalize(row.key) })),
  )
  rowsByType.set(
    'dive',
    (
      await transaction
        .select({ id: dives.id, createdAt: dives.createdAt, number: dives.number })
        .from(dives)
    ).map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      key: row.number === null ? null : String(row.number),
    })),
  )

  const repairs: RoundTripDuplicate[] = []
  for (const [entityType, rows] of rowsByType) {
    const sourceLinks = linkedRecords.get(entityType)
    if (!sourceLinks) continue
    const groups = new Map<string, typeof rows>()
    for (const row of rows) {
      if (row.key === null || !sourceLinks.has(row.id)) continue
      const group = groups.get(row.key) ?? []
      group.push(row)
      groups.set(row.key, group)
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue
      group.sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() ||
          left.id.localeCompare(right.id),
      )
      const original = group[0]
      if (!original) continue
      for (const duplicate of group.slice(1)) {
        for (const externalRecordId of sourceLinks.get(duplicate.id) ?? []) {
          repairs.push({
            entityType,
            externalRecordId,
            duplicateId: duplicate.id,
            originalId: original.id,
          })
        }
      }
    }
  }
  return repairs
}

/**
 * Repair canonical copies created by the old write-back implementation. It
 * changed numeric DiveMate IDs even though those IDs are import identities,
 * but it also wrote the canonical UUID into every exported row. Prefer that
 * exact key while it survives. If a later broken write-back replaced it, use
 * the same stable natural keys the import contract already uses (entity name,
 * or the unique dive number), limited to rows owned by this integration.
 */
async function repairRoundTripDuplicates(
  transaction: DatabaseTransaction,
  records: ObservedExternalRecord[],
  signal: AbortSignal,
) {
  const candidates: RoundTripDuplicate[] = []
  for (const record of records) {
    if (!isDirectCanonicalSourceType(record.input.entityType)) continue
    const originalId = record.input.rawPayload.UUID
    if (
      typeof originalId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(originalId)
    ) {
      continue
    }
    const directLink = record.canonicalLinks.find(
      (link) => link.canonicalEntityType === record.input.entityType,
    )
    if (!directLink || directLink.canonicalEntityId === originalId) continue
    candidates.push({
      entityType: record.input.entityType,
      externalRecordId: record.id,
      duplicateId: directLink.canonicalEntityId,
      originalId,
    })
  }

  const existing = new Set<string>()
  for (const entityType of Object.keys(
    canonicalTableBySourceType,
  ) as DirectCanonicalSourceType[]) {
    const ids = candidates
      .filter((candidate) => candidate.entityType === entityType)
      .flatMap((candidate) => [candidate.originalId, candidate.duplicateId])
    for (const id of await existingCanonicalIds(transaction, entityType, [
      ...new Set(ids),
    ])) {
      existing.add(`${entityType}:${id}`)
    }
  }
  const existingCandidates = candidates.filter(
    ({ entityType, duplicateId, originalId }) =>
      existing.has(`${entityType}:${duplicateId}`) &&
      existing.has(`${entityType}:${originalId}`),
  )
  const targetsByDuplicate = new Map<string, Set<string>>()
  for (const candidate of existingCandidates) {
    const key = `${candidate.entityType}:${candidate.duplicateId}`
    const targets = targetsByDuplicate.get(key) ?? new Set<string>()
    targets.add(candidate.originalId)
    targetsByDuplicate.set(key, targets)
  }
  // Refuse an internally inconsistent mapping instead of guessing which UUID
  // owns a generated row. The old exporter produced one unambiguous target.
  const exactRepairs = existingCandidates.filter(
    (candidate) =>
      targetsByDuplicate.get(`${candidate.entityType}:${candidate.duplicateId}`)?.size ===
      1,
  )
  const exactLosers = new Set(
    exactRepairs.map((repair) => `${repair.entityType}:${repair.duplicateId}`),
  )
  const legacyRepairs = (
    await inferLegacyRoundTripDuplicates(transaction, records)
  ).filter((repair) => !exactLosers.has(`${repair.entityType}:${repair.duplicateId}`))
  const repairs = [...exactRepairs, ...legacyRepairs]
  if (repairs.length === 0) return 0

  // The shuffled source record becomes a matched reference to the original.
  // Remove its derived links too, so children of the generated copy cannot be
  // recreated on a later import.
  for (const repair of repairs) {
    signal.throwIfAborted()
    await transaction
      .delete(externalRecordLinks)
      .where(eq(externalRecordLinks.externalRecordId, repair.externalRecordId))
    await transaction.insert(externalRecordLinks).values({
      externalRecordId: repair.externalRecordId,
      canonicalEntityType: repair.entityType,
      canonicalEntityId: repair.originalId,
      role: MATCHED_LINK_ROLE,
    })
    const record = records.find((candidate) => candidate.id === repair.externalRecordId)
    if (record) {
      record.canonicalLinks = [
        {
          canonicalEntityType: repair.entityType,
          canonicalEntityId: repair.originalId,
          role: MATCHED_LINK_ROLE,
        },
      ]
    }
  }

  const byType = new Map<DirectCanonicalSourceType, RoundTripDuplicate[]>()
  for (const repair of repairs) {
    const key = `${repair.entityType}:${repair.duplicateId}`
    const entries = byType.get(repair.entityType) ?? []
    if (!entries.some((entry) => `${entry.entityType}:${entry.duplicateId}` === key)) {
      entries.push(repair)
      byType.set(repair.entityType, entries)
    }
  }

  const repointRemainingProvenance = async (repair: RoundTripDuplicate) => {
    const links = await transaction
      .select({ externalRecordId: externalRecordLinks.externalRecordId })
      .from(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, repair.entityType),
          eq(externalRecordLinks.canonicalEntityId, repair.duplicateId),
        ),
      )
    if (links.length === 0) return
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, repair.entityType),
          eq(externalRecordLinks.canonicalEntityId, repair.duplicateId),
        ),
      )
    await transaction
      .insert(externalRecordLinks)
      .values(
        links.map(({ externalRecordId }) => ({
          externalRecordId,
          canonicalEntityType: repair.entityType,
          canonicalEntityId: repair.originalId,
          role: MATCHED_LINK_ROLE,
        })),
      )
      .onConflictDoNothing()
  }

  for (const repair of byType.get('equipment_set') ?? []) {
    const rows = await transaction
      .select({
        equipmentId: equipmentSetItems.equipmentId,
        sortOrder: equipmentSetItems.sortOrder,
      })
      .from(equipmentSetItems)
      .where(eq(equipmentSetItems.equipmentSetId, repair.duplicateId))
    if (rows.length > 0) {
      await transaction
        .insert(equipmentSetItems)
        .values(rows.map((row) => ({ ...row, equipmentSetId: repair.originalId })))
        .onConflictDoNothing()
    }
    await repointRemainingProvenance(repair)
    await transaction
      .delete(equipmentSets)
      .where(eq(equipmentSets.id, repair.duplicateId))
  }
  for (const repair of byType.get('equipment') ?? []) {
    const diveRows = await transaction
      .select({ diveId: diveEquipment.diveId })
      .from(diveEquipment)
      .where(eq(diveEquipment.equipmentId, repair.duplicateId))
    if (diveRows.length > 0) {
      await transaction
        .insert(diveEquipment)
        .values(diveRows.map((row) => ({ ...row, equipmentId: repair.originalId })))
        .onConflictDoNothing()
    }
    const setRows = await transaction
      .select({
        equipmentSetId: equipmentSetItems.equipmentSetId,
        sortOrder: equipmentSetItems.sortOrder,
      })
      .from(equipmentSetItems)
      .where(eq(equipmentSetItems.equipmentId, repair.duplicateId))
    if (setRows.length > 0) {
      await transaction
        .insert(equipmentSetItems)
        .values(setRows.map((row) => ({ ...row, equipmentId: repair.originalId })))
        .onConflictDoNothing()
    }
    await transaction
      .update(pictures)
      .set({ equipmentId: repair.originalId })
      .where(eq(pictures.equipmentId, repair.duplicateId))
    await repointRemainingProvenance(repair)
    await transaction.delete(equipment).where(eq(equipment.id, repair.duplicateId))
  }
  for (const repair of byType.get('buddy') ?? []) {
    const diveRows = await transaction
      .select({ diveId: diveBuddies.diveId, role: diveBuddies.role })
      .from(diveBuddies)
      .where(eq(diveBuddies.buddyId, repair.duplicateId))
    if (diveRows.length > 0) {
      await transaction
        .insert(diveBuddies)
        .values(diveRows.map((row) => ({ ...row, buddyId: repair.originalId })))
        .onConflictDoNothing()
    }
    const memberships = await transaction
      .select({
        agencyId: buddyAgencyMemberships.agencyId,
        memberNumber: buddyAgencyMemberships.memberNumber,
      })
      .from(buddyAgencyMemberships)
      .where(eq(buddyAgencyMemberships.buddyId, repair.duplicateId))
    if (memberships.length > 0) {
      await transaction
        .insert(buddyAgencyMemberships)
        .values(memberships.map((row) => ({ ...row, buddyId: repair.originalId })))
        .onConflictDoNothing()
    }
    await transaction
      .update(buddyCertifications)
      .set({ buddyId: repair.originalId })
      .where(eq(buddyCertifications.buddyId, repair.duplicateId))
    await transaction
      .update(certifications)
      .set({ instructorBuddyId: repair.originalId })
      .where(eq(certifications.instructorBuddyId, repair.duplicateId))
    await transaction
      .update(pictures)
      .set({ buddyId: repair.originalId })
      .where(eq(pictures.buddyId, repair.duplicateId))
    await repointRemainingProvenance(repair)
    await transaction.delete(buddies).where(eq(buddies.id, repair.duplicateId))
  }
  for (const repair of byType.get('dive_site') ?? []) {
    await transaction
      .update(dives)
      .set({ siteId: repair.originalId })
      .where(eq(dives.siteId, repair.duplicateId))
    await transaction
      .update(pictures)
      .set({ siteId: repair.originalId })
      .where(eq(pictures.siteId, repair.duplicateId))
    await repointRemainingProvenance(repair)
    await transaction.delete(diveSites).where(eq(diveSites.id, repair.duplicateId))
  }
  for (const repair of byType.get('shop') ?? []) {
    await transaction
      .update(dives)
      .set({ shopId: repair.originalId })
      .where(eq(dives.shopId, repair.duplicateId))
    await repointRemainingProvenance(repair)
    await transaction.delete(shops).where(eq(shops.id, repair.duplicateId))
  }
  for (const repair of byType.get('dive_type') ?? []) {
    await transaction
      .update(dives)
      .set({ diveTypeId: repair.originalId })
      .where(eq(dives.diveTypeId, repair.duplicateId))
    await repointRemainingProvenance(repair)
    await transaction.delete(diveTypes).where(eq(diveTypes.id, repair.duplicateId))
  }
  for (const repair of byType.get('diver') ?? []) {
    await transaction
      .update(dives)
      .set({ diverId: repair.originalId })
      .where(eq(dives.diverId, repair.duplicateId))
    await transaction
      .update(equipment)
      .set({ diverId: repair.originalId })
      .where(eq(equipment.diverId, repair.duplicateId))
    await transaction
      .update(certifications)
      .set({ diverId: repair.originalId })
      .where(eq(certifications.diverId, repair.duplicateId))
    await transaction
      .update(agencyMemberships)
      .set({ diverId: repair.originalId })
      .where(eq(agencyMemberships.diverId, repair.duplicateId))
    await transaction
      .update(pictures)
      .set({ diverId: repair.originalId })
      .where(eq(pictures.diverId, repair.duplicateId))
    await repointRemainingProvenance(repair)
    await transaction.delete(divers).where(eq(divers.id, repair.duplicateId))
  }
  for (const entityType of ['picture', 'tank', 'certification'] as const) {
    for (const repair of byType.get(entityType) ?? []) {
      await repointRemainingProvenance(repair)
      await transaction
        .delete(canonicalTableBySourceType[entityType])
        .where(eq(canonicalTableBySourceType[entityType].id, repair.duplicateId))
    }
  }
  for (const repair of byType.get('dive') ?? []) {
    const discardImportedChildren = async (
      entityType: 'tank' | 'picture',
      canonicalIds: string[],
    ) => {
      const ids = new Set(canonicalIds)
      const sourceRecords = records.filter(
        (record) =>
          record.input.entityType === entityType &&
          record.canonicalLinks.some(
            (link) =>
              link.canonicalEntityType === entityType && ids.has(link.canonicalEntityId),
          ),
      )
      if (sourceRecords.length === 0) return
      await transaction.delete(externalRecordLinks).where(
        inArray(
          externalRecordLinks.externalRecordId,
          sourceRecords.map((row) => row.id),
        ),
      )
      for (const record of sourceRecords) record.canonicalLinks = []
      if (entityType === 'tank') {
        await transaction.delete(tanks).where(inArray(tanks.id, canonicalIds))
      } else {
        await transaction.delete(pictures).where(inArray(pictures.id, canonicalIds))
      }
    }
    await discardImportedChildren(
      'tank',
      (
        await transaction
          .select({ id: tanks.id })
          .from(tanks)
          .where(eq(tanks.diveId, repair.duplicateId))
      ).map((row) => row.id),
    )
    await discardImportedChildren(
      'picture',
      (
        await transaction
          .select({ id: pictures.id })
          .from(pictures)
          .where(eq(pictures.diveId, repair.duplicateId))
      ).map((row) => row.id),
    )
    const buddiesOnDive = await transaction
      .select({ buddyId: diveBuddies.buddyId, role: diveBuddies.role })
      .from(diveBuddies)
      .where(eq(diveBuddies.diveId, repair.duplicateId))
    if (buddiesOnDive.length > 0) {
      await transaction
        .insert(diveBuddies)
        .values(buddiesOnDive.map((row) => ({ ...row, diveId: repair.originalId })))
        .onConflictDoNothing()
    }
    const gearOnDive = await transaction
      .select({ equipmentId: diveEquipment.equipmentId })
      .from(diveEquipment)
      .where(eq(diveEquipment.diveId, repair.duplicateId))
    if (gearOnDive.length > 0) {
      await transaction
        .insert(diveEquipment)
        .values(gearOnDive.map((row) => ({ ...row, diveId: repair.originalId })))
        .onConflictDoNothing()
    }
    await transaction
      .update(pictures)
      .set({ diveId: repair.originalId })
      .where(eq(pictures.diveId, repair.duplicateId))
    await transaction
      .update(diveEvents)
      .set({ diveId: repair.originalId })
      .where(eq(diveEvents.diveId, repair.duplicateId))
    await transaction
      .update(tanks)
      .set({ diveId: repair.originalId })
      .where(eq(tanks.diveId, repair.duplicateId))
    await repointRemainingProvenance(repair)
    await transaction.delete(dives).where(eq(dives.id, repair.duplicateId))
  }
  return [...byType.values()].reduce((total, entries) => total + entries.length, 0)
}

async function ensureDiveMateDiveTypes(transaction: DatabaseTransaction) {
  const existingNames = new Set(
    (await transaction.select({ name: diveTypes.name }).from(diveTypes)).map((diveType) =>
      diveType.name.trim().toLocaleLowerCase('en-US'),
    ),
  )
  const missing = DEFAULT_DIVEMATE_DIVE_TYPES.filter(
    (name) => !existingNames.has(name.toLocaleLowerCase('en-US')),
  )
  if (missing.length === 0) return
  await transaction.insert(diveTypes).values(
    missing.map((name) => ({
      name,
      sortOrder: DEFAULT_DIVEMATE_DIVE_TYPES.indexOf(name) + 1,
    })),
  )
}

async function loadBuddyNameIndex(transaction: DatabaseTransaction) {
  const rows = await transaction
    .select({
      id: buddies.id,
      firstName: buddies.firstName,
      lastName: buddies.lastName,
    })
    .from(buddies)
    .orderBy(asc(buddies.createdAt), asc(buddies.id))
  const index = new Map<string, string>()
  for (const buddy of rows) {
    const normalizedName = normalizeDiveMateInstructorName(
      formatDiveMateInstructor(buddy),
    )
    if (normalizedName && !index.has(normalizedName)) {
      index.set(normalizedName, buddy.id)
    }
  }
  return index
}

async function resolveNamedBuddy(
  transaction: DatabaseTransaction,
  index: Map<string, string>,
  importedName: string | null,
  createMissing = true,
) {
  const name = cleanDiveMateInstructorName(importedName)
  const normalizedName = normalizeDiveMateInstructorName(name)
  if (!name || !normalizedName) return null

  const existingId = index.get(normalizedName)
  if (existingId) return existingId
  if (!createMissing) return null

  const [buddy] = await transaction
    .insert(buddies)
    .values({ firstName: name })
    .returning({ id: buddies.id })
  if (!buddy) throw new Error('DiveMate person could not be linked to a buddy')
  index.set(normalizedName, buddy.id)
  return buddy.id
}

async function storeImage(
  storage: StorageProvider,
  category: 'certifications' | 'pictures',
  externalId: string,
  bytes: Uint8Array,
  mimeType: string,
  signal: AbortSignal,
): Promise<StoredImage> {
  signal.throwIfAborted()
  const fingerprint = createHash('sha256').update(bytes).digest('hex')
  const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1]
  const storagePath = `divemate/${category}/${externalId}/${fingerprint}.${extension}`
  if (!(await storage.exists(storagePath))) {
    signal.throwIfAborted()
    await storage.upload(
      new Blob([Uint8Array.from(bytes)], { type: mimeType }),
      storagePath,
    )
  }
  const thumbnailStoragePath = thumbnailPathFor(storagePath)
  if (!(await storage.exists(thumbnailStoragePath))) {
    signal.throwIfAborted()
    const thumbnail = await createThumbnail(
      bytes,
      category === 'certifications' ? 'certification' : 'photo',
    )
    await storage.upload(
      new Blob([Uint8Array.from(thumbnail)], { type: 'image/webp' }),
      thumbnailStoragePath,
    )
  }
  return {
    storagePath,
    thumbnailStoragePath,
    mimeType,
    byteSize: bytes.byteLength,
    checksum: fingerprint,
  }
}

async function storeSnapshotMedia(
  snapshot: DiveMateSnapshot,
  signal: AbortSignal,
  externalImages?: ExternalImages,
): Promise<StoredDiveMateMedia> {
  const storage = getStorage()
  const storedPictures = new Map<string, StoredImage>()
  for (const picture of snapshot.pictures) {
    signal.throwIfAborted()
    const external = externalImages?.pictures.get(picture.externalId)
    const bytes = picture.imageBytes ?? external?.bytes
    const mimeType = picture.mimeType ?? external?.mimeType
    if (!bytes || !mimeType) continue
    storedPictures.set(
      picture.externalId,
      await storeImage(storage, 'pictures', picture.externalId, bytes, mimeType, signal),
    )
  }
  const storedCertificationScans = new Map<
    string,
    { scan1?: StoredImage; scan2?: StoredImage }
  >()
  for (const certification of snapshot.certifications) {
    signal.throwIfAborted()
    const scans: { scan1?: StoredImage; scan2?: StoredImage } = {}
    const external = externalImages?.certificationScans.get(certification.externalId)
    const scan1Bytes = certification.scan1Bytes ?? external?.scan1?.bytes
    const scan1MimeType = certification.scan1MimeType ?? external?.scan1?.mimeType
    const scan2Bytes = certification.scan2Bytes ?? external?.scan2?.bytes
    const scan2MimeType = certification.scan2MimeType ?? external?.scan2?.mimeType
    if (scan1Bytes && scan1MimeType) {
      scans.scan1 = await storeImage(
        storage,
        'certifications',
        `${certification.externalId}/front`,
        scan1Bytes,
        scan1MimeType,
        signal,
      )
    }
    if (scan2Bytes && scan2MimeType) {
      scans.scan2 = await storeImage(
        storage,
        'certifications',
        `${certification.externalId}/back`,
        scan2Bytes,
        scan2MimeType,
        signal,
      )
    }
    if (scans.scan1 || scans.scan2)
      storedCertificationScans.set(certification.externalId, scans)
  }
  return {
    pictures: storedPictures,
    certificationScans: storedCertificationScans,
  }
}

async function applySnapshot(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  storedMedia: StoredDiveMateMedia,
  context: SnapshotApplyContext,
) {
  const storedPictures = storedMedia.pictures
  const storedCertificationScans = storedMedia.certificationScans
  const enabled = context.isEntityEnabled
  // A switched-off entity still resolves for the records that point at it, but
  // only to rows an earlier run already linked; nothing new is created for it.
  const referenceIds = (entityKey: string, entityType: string) =>
    enabled(entityKey)
      ? Promise.resolve(new Map<string, string>())
      : context.previouslyLinkedIds(entityType, entityType)

  const diverIds = await referenceIds('divers', 'diver')
  for (const item of enabled('divers') ? snapshot.divers : []) {
    context.signal.throwIfAborted()
    const existingId = context.canonicalId('diver', item.externalId, 'diver')
    if (!context.shouldApply('diver', item.externalId) && existingId) {
      diverIds.set(item.externalId, existingId)
      continue
    }
    const values = {
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      phone: item.phone,
      street: item.street,
      postalCode: item.postalCode,
      city: item.city,
      state: item.state,
      country: item.country,
      birthDate: item.birthDate,
      bloodGroup: item.bloodGroup,
      emergencyContact: item.emergencyContact,
      emergencyPhone: item.emergencyPhone,
      emergencyEmail: item.emergencyEmail,
      insurance: item.insurance,
      notes: item.notes,
      updatedAt: new Date(),
    }
    const [row] = existingId
      ? await tx
          .update(divers)
          .set(values)
          .where(eq(divers.id, existingId))
          .returning({ id: divers.id })
      : await tx.insert(divers).values(values).returning({ id: divers.id })
    if (row) {
      diverIds.set(item.externalId, row.id)
      await context.link('diver', item.externalId, 'diver', row.id)
    }
  }

  const siteIds = await referenceIds('dive_sites', 'dive_site')
  for (const item of enabled('dive_sites') ? snapshot.sites : []) {
    context.signal.throwIfAborted()
    const existingId = context.canonicalId('dive_site', item.externalId, 'dive_site')
    if (!context.shouldApply('dive_site', item.externalId) && existingId) {
      siteIds.set(item.externalId, existingId)
      continue
    }
    const values = {
      name: item.name,
      country: item.country,
      region: item.region,
      waterName: item.waterName,
      latitude: item.latitude,
      longitude: item.longitude,
      maximumDepthMeters: item.maximumDepthMeters,
      altitudeMeters: item.altitudeMeters,
      difficulty: item.difficulty,
      rating: item.rating,
      waterType: item.waterType,
      notes: item.notes,
      updatedAt: new Date(),
    }
    const [row] = existingId
      ? await tx
          .update(diveSites)
          .set(values)
          .where(eq(diveSites.id, existingId))
          .returning({ id: diveSites.id })
      : await tx.insert(diveSites).values(values).returning({ id: diveSites.id })
    if (row) {
      siteIds.set(item.externalId, row.id)
      await context.link('dive_site', item.externalId, 'dive_site', row.id)
    }
  }

  const buddyIds = await referenceIds('buddies', 'buddy')
  for (const item of enabled('buddies') ? snapshot.buddies : []) {
    context.signal.throwIfAborted()
    const existingId = context.canonicalId('buddy', item.externalId, 'buddy')
    if (!context.shouldApply('buddy', item.externalId) && existingId) {
      buddyIds.set(item.externalId, existingId)
      continue
    }
    const values = {
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      phone: item.phone,
      street: item.street,
      postalCode: item.postalCode,
      city: item.city,
      state: item.state,
      country: item.country,
      notes: item.notes,
      updatedAt: new Date(),
    }
    const [row] = existingId
      ? await tx
          .update(buddies)
          .set(values)
          .where(eq(buddies.id, existingId))
          .returning({ id: buddies.id })
      : await tx.insert(buddies).values(values).returning({ id: buddies.id })
    if (row) {
      buddyIds.set(item.externalId, row.id)
      await context.link('buddy', item.externalId, 'buddy', row.id)
    }
  }

  const buddyIdsByName = await loadBuddyNameIndex(tx)
  // With buddies switched off, a name on a dive or certification still attaches
  // to a person already in the logbook but never creates a new one.
  const namedBuddy = (importedName: string | null) =>
    resolveNamedBuddy(tx, buddyIdsByName, importedName, enabled('buddies'))

  const equipmentIds = await referenceIds('equipment', 'equipment')
  const equipmentItems = enabled('equipment')
    ? snapshot.equipment.filter((candidate) => !candidate.isSet)
    : []
  for (const item of equipmentItems) {
    context.signal.throwIfAborted()
    const existingId = context.canonicalId('equipment', item.externalId, 'equipment')
    if (!context.shouldApply('equipment', item.externalId) && existingId) {
      equipmentIds.set(item.externalId, existingId)
      continue
    }
    const values = {
      diverId: item.diverExternalId ? (diverIds.get(item.diverExternalId) ?? null) : null,
      name: item.name,
      category: item.category,
      manufacturer: item.manufacturer,
      model: item.model,
      serialNumber: item.serialNumber,
      information: item.information,
      purchasedAt: item.purchasedAt,
      purchasePrice: item.purchasePrice,
      purchaseShop: item.purchaseShop,
      retiredAt: item.retiredAt,
      serviceDueAt: item.serviceDueAt,
      inactive: item.inactive,
      weightKg: item.weightKg,
      notes: item.notes,
      updatedAt: new Date(),
    }
    const [row] = existingId
      ? await tx
          .update(equipment)
          .set(values)
          .where(eq(equipment.id, existingId))
          .returning({ id: equipment.id })
      : await tx.insert(equipment).values(values).returning({ id: equipment.id })
    if (row) {
      equipmentIds.set(item.externalId, row.id)
      await context.link('equipment', item.externalId, 'equipment', row.id)
    }
  }

  const equipmentSetSources = enabled('equipment_sets')
    ? snapshot.equipment.filter((candidate) => candidate.isSet)
    : []
  for (const item of equipmentSetSources) {
    context.signal.throwIfAborted()
    const existingId = context.canonicalId(
      'equipment_set',
      item.externalId,
      'equipment_set',
    )
    if (!context.shouldApply('equipment_set', item.externalId) && existingId) continue
    const values = {
      name: item.name,
      notes: item.notes,
      inactive: item.inactive,
      updatedAt: new Date(),
    }
    const [row] = existingId
      ? await tx
          .update(equipmentSets)
          .set(values)
          .where(eq(equipmentSets.id, existingId))
          .returning({ id: equipmentSets.id })
      : await tx.insert(equipmentSets).values(values).returning({ id: equipmentSets.id })
    if (!row) continue
    await context.link('equipment_set', item.externalId, 'equipment_set', row.id)
    await tx.delete(equipmentSetItems).where(eq(equipmentSetItems.equipmentSetId, row.id))
    const memberIds = item.memberExternalIds
      .map((externalId) => equipmentIds.get(externalId))
      .filter((id): id is string => Boolean(id))
    if (memberIds.length > 0) {
      await tx.insert(equipmentSetItems).values(
        [...new Set(memberIds)].map((equipmentId, sortOrder) => ({
          equipmentSetId: row.id,
          equipmentId,
          sortOrder,
        })),
      )
    }
  }

  const shopIds = await referenceIds('shops', 'shop')
  for (const item of enabled('shops') ? snapshot.shops : []) {
    context.signal.throwIfAborted()
    const existingId = context.canonicalId('shop', item.externalId, 'shop')
    if (!context.shouldApply('shop', item.externalId) && existingId) {
      shopIds.set(item.externalId, existingId)
      continue
    }
    const values = { name: item.name, updatedAt: new Date() }
    const [row] = existingId
      ? await tx
          .update(shops)
          .set(values)
          .where(eq(shops.id, existingId))
          .returning({ id: shops.id })
      : await tx.insert(shops).values(values).returning({ id: shops.id })
    if (row) {
      shopIds.set(item.externalId, row.id)
      await context.link('shop', item.externalId, 'shop', row.id)
    }
  }

  const diveTypeIdsByName = new Map(
    (
      await tx
        .select({ id: diveTypes.id, name: diveTypes.name })
        .from(diveTypes)
        .orderBy(asc(diveTypes.createdAt))
    ).map((diveType) => [diveType.name.trim().toLocaleLowerCase('en-US'), diveType.id]),
  )
  const diveTypeIds = await referenceIds('dive_types', 'dive_type')
  for (const item of enabled('dive_types') ? snapshot.diveTypes : []) {
    context.signal.throwIfAborted()
    const linkedId = context.canonicalId('dive_type', item.externalId, 'dive_type')
    if (!context.shouldApply('dive_type', item.externalId) && linkedId) {
      diveTypeIds.set(item.externalId, linkedId)
      continue
    }
    const values = {
      name: item.name,
      sortOrder: item.sortOrder,
      updatedAt: new Date(),
    }
    const existingId =
      linkedId ?? diveTypeIdsByName.get(item.name.trim().toLocaleLowerCase('en-US'))
    const [row] = linkedId
      ? await tx
          .update(diveTypes)
          .set(values)
          .where(eq(diveTypes.id, linkedId))
          .returning({ id: diveTypes.id })
      : existingId
        ? [{ id: existingId }]
        : await tx.insert(diveTypes).values(values).returning({ id: diveTypes.id })
    if (row) {
      diveTypeIds.set(item.externalId, row.id)
      diveTypeIdsByName.set(item.name.trim().toLocaleLowerCase('en-US'), row.id)
      await context.link(
        'dive_type',
        item.externalId,
        'dive_type',
        row.id,
        linkedId || !existingId ? 'produced' : MATCHED_LINK_ROLE,
      )
    }
  }

  for (const item of enabled('certifications') ? snapshot.certifications : []) {
    context.signal.throwIfAborted()
    if (!context.shouldApply('certification', item.externalId)) continue
    const existingId = context.canonicalId(
      'certification',
      item.externalId,
      'certification',
    )
    const scans = storedCertificationScans.get(item.externalId)
    const instructorBuddyId = await namedBuddy(item.instructorName)
    const agencyId = await resolveAgencyId(tx, item.organization)
    const referenceValues = {
      diverId: item.diverExternalId ? (diverIds.get(item.diverExternalId) ?? null) : null,
      name: item.name,
      organization: item.organization,
      agencyId,
      certificationNumber: item.certificationNumber,
      certifiedAt: item.certifiedAt,
      instructorBuddyId,
      sortOrder: item.sortOrder,
      scan1Path: item.scan1Path,
      scan2Path: item.scan2Path,
    }
    if (instructorBuddyId && agencyId && item.instructorNumber) {
      await tx
        .insert(buddyAgencyMemberships)
        .values({
          buddyId: instructorBuddyId,
          agencyId,
          memberNumber: item.instructorNumber,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [buddyAgencyMemberships.buddyId, buddyAgencyMemberships.agencyId],
          set: { memberNumber: item.instructorNumber, updatedAt: new Date() },
        })
    }
    const values = {
      ...referenceValues,
      scan1StoragePath: scans?.scan1?.storagePath ?? null,
      scan1ThumbnailStoragePath: scans?.scan1?.thumbnailStoragePath ?? null,
      scan1MimeType: scans?.scan1?.mimeType ?? null,
      scan1ByteSize: scans?.scan1?.byteSize ?? null,
      scan2StoragePath: scans?.scan2?.storagePath ?? null,
      scan2ThumbnailStoragePath: scans?.scan2?.thumbnailStoragePath ?? null,
      scan2MimeType: scans?.scan2?.mimeType ?? null,
      scan2ByteSize: scans?.scan2?.byteSize ?? null,
      updatedAt: new Date(),
    }
    const [row] = existingId
      ? await tx
          .update(certifications)
          .set(scans ? values : { ...referenceValues, updatedAt: new Date() })
          .where(eq(certifications.id, existingId))
          .returning({ id: certifications.id })
      : await tx
          .insert(certifications)
          .values(values)
          .returning({ id: certifications.id })
    if (row) {
      await context.link('certification', item.externalId, 'certification', row.id)
    }
  }

  const boatIdsByName = new Map(
    (await tx.select({ id: boats.id, name: boats.name }).from(boats)).map((boat) => [
      boat.name.trim().toLowerCase(),
      boat.id,
    ]),
  )
  // A matched dive was merged away or existed before the import, so tanks and
  // pictures must not land on it; that holds for dives linked in earlier runs.
  const diveIds = enabled('dives')
    ? new Map<string, string>()
    : await context.previouslyLinkedIds('dive', 'dive', {
        excludeMatched: true,
      })
  const profileSamplesByDive = new Map<string, DiveMateSnapshot['profileSamples']>()
  for (const sample of enabled('profile_samples') ? snapshot.profileSamples : []) {
    context.signal.throwIfAborted()
    const samples = profileSamplesByDive.get(sample.diveExternalId) ?? []
    samples.push(sample)
    profileSamplesByDive.set(sample.diveExternalId, samples)
  }

  for (const item of enabled('dives') ? snapshot.dives : []) {
    context.signal.throwIfAborted()
    // A matched dive belongs to the logbook rather than to this backup — it
    // was merged into another dive, or already existed here. Leaving it out of
    // `diveIds` also keeps its tanks and pictures from landing on the dive that
    // absorbed it.
    if (context.canonicalRole('dive', item.externalId, 'dive') === MATCHED_LINK_ROLE) {
      continue
    }
    const existingId = context.canonicalId('dive', item.externalId, 'dive')
    if (!context.shouldApply('dive', item.externalId) && existingId) {
      diveIds.set(item.externalId, existingId)
      continue
    }
    const sourceBoatName = item.boat?.trim() || null
    let boatId = context.canonicalId('dive', item.externalId, 'boat')
    if (sourceBoatName && !boatId) {
      boatId = boatIdsByName.get(sourceBoatName.toLowerCase()) ?? null
      if (!boatId) {
        const [createdBoat] = await tx
          .insert(boats)
          .values({ name: sourceBoatName })
          .returning({ id: boats.id })
        boatId = createdBoat?.id ?? null
        if (boatId) boatIdsByName.set(sourceBoatName.toLowerCase(), boatId)
      }
    }
    const values = {
      captureSource: item.captureSource,
      diverId: item.diverExternalId ? (diverIds.get(item.diverExternalId) ?? null) : null,
      siteId: item.siteExternalId ? (siteIds.get(item.siteExternalId) ?? null) : null,
      shopId: item.shopExternalId ? (shopIds.get(item.shopExternalId) ?? null) : null,
      boatId: sourceBoatName ? boatId : null,
      diveTypeId: item.diveTypeExternalId
        ? (diveTypeIds.get(item.diveTypeExternalId) ?? null)
        : null,
      number: item.number,
      diveDate: item.diveDate,
      entryTime: item.entryTime,
      utcOffsetMinutes: item.utcOffsetMinutes,
      durationSeconds: item.durationSeconds,
      surfaceIntervalSeconds: item.surfaceIntervalSeconds,
      maximumDepthMeters: item.maximumDepthMeters,
      averageDepthMeters: item.averageDepthMeters,
      airTemperatureCelsius: item.airTemperatureCelsius,
      waterTemperatureCelsius: item.waterTemperatureCelsius,
      weightKg: item.weightKg,
      equipmentWeightKg: item.equipmentWeightKg,
      maximumPpo2: item.maximumPpo2,
      decompressionDive: item.decompressionDive,
      visibility: item.visibility,
      current: item.current,
      waves: item.waves,
      weather: item.weather,
      waterType: item.waterType,
      entryType: item.entryType,
      rating: item.rating,
      computer: item.computer,
      suit: item.suit,
      notes: item.notes,
      updatedAt: new Date(),
    }
    const [row] = existingId
      ? await tx
          .update(dives)
          .set(values)
          .where(eq(dives.id, existingId))
          .returning({ id: dives.id })
      : await tx.insert(dives).values(values).returning({ id: dives.id })
    if (!row) continue
    diveIds.set(item.externalId, row.id)
    await context.link('dive', item.externalId, 'dive', row.id)
    await context.unlink('dive', item.externalId, ['boat'])
    if (sourceBoatName && boatId) {
      await context.link('dive', item.externalId, 'boat', boatId)
    }

    const oldBuddyLinks = context.canonicalIds('dive', item.externalId, 'dive_buddy')
    if (oldBuddyLinks.length > 0)
      await tx.delete(diveBuddies).where(inArray(diveBuddies.id, oldBuddyLinks))
    await context.unlink('dive', item.externalId, ['dive_buddy'])
    const importedBuddyRoles = new Map<string, DiveBuddyRole>(
      item.buddyExternalIds
        .map((id) => buddyIds.get(id))
        .filter((id): id is string => Boolean(id))
        .map((buddyId) => [buddyId, 'buddy' as const]),
    )
    const namedBuddyId = await namedBuddy(item.buddyName)
    if (namedBuddyId) importedBuddyRoles.set(namedBuddyId, 'buddy')
    for (const member of parseDiveMateDiveTeam(item.divemaster)) {
      const staffBuddyId = await namedBuddy(member.name)
      if (staffBuddyId) importedBuddyRoles.set(staffBuddyId, member.role)
    }
    if (importedBuddyRoles.size > 0) {
      for (const [buddyId, role] of importedBuddyRoles) {
        context.signal.throwIfAborted()
        const [association] = await tx
          .insert(diveBuddies)
          .values({ diveId: row.id, buddyId, role })
          .onConflictDoUpdate({
            target: [diveBuddies.diveId, diveBuddies.buddyId],
            set: { role },
          })
          .returning({ id: diveBuddies.id })
        if (association)
          await context.link('dive', item.externalId, 'dive_buddy', association.id)
      }
    }

    const oldEquipmentLinks = context.canonicalIds(
      'dive',
      item.externalId,
      'dive_equipment',
    )
    if (oldEquipmentLinks.length > 0)
      await tx.delete(diveEquipment).where(inArray(diveEquipment.id, oldEquipmentLinks))
    await context.unlink('dive', item.externalId, ['dive_equipment'])
    const importedEquipmentIds = item.equipmentExternalIds
      .flatMap((id) => {
        const source = snapshot.equipment.find((candidate) => candidate.externalId === id)
        return source?.isSet ? source.memberExternalIds : [id]
      })
      .map((id) => equipmentIds.get(id))
      .filter((id): id is string => Boolean(id))
    if (importedEquipmentIds.length > 0) {
      for (const equipmentId of importedEquipmentIds) {
        context.signal.throwIfAborted()
        const [association] = await tx
          .insert(diveEquipment)
          .values({ diveId: row.id, equipmentId })
          .onConflictDoUpdate({
            target: [diveEquipment.diveId, diveEquipment.equipmentId],
            set: { equipmentId },
          })
          .returning({ id: diveEquipment.id })
        if (association)
          await context.link('dive', item.externalId, 'dive_equipment', association.id)
      }
    }

    // With profiles switched off a changed dive keeps the samples it already
    // has; replacing them with nothing would be a deletion.
    if (!enabled('profile_samples')) continue
    const oldProfileSamples = context.canonicalIds(
      'dive',
      item.externalId,
      'profile_sample',
    )
    if (oldProfileSamples.length > 0)
      await tx
        .delete(diveProfileSamples)
        .where(inArray(diveProfileSamples.id, oldProfileSamples))
    await context.unlink('dive', item.externalId, ['profile_sample'])
    const importedProfileSamples = profileSamplesByDive.get(item.externalId) ?? []
    if (importedProfileSamples.length > 0) {
      const insertedSamples = await tx
        .insert(diveProfileSamples)
        .values(
          importedProfileSamples.map((sample) => ({
            diveId: row.id,
            sampleIndex: sample.sampleIndex,
            elapsedSeconds: sample.elapsedSeconds,
            depthMeters: sample.depthMeters,
            temperatureCelsius: sample.temperatureCelsius,
            pressureBar: sample.pressureBar,
            tank1PressureBar: sample.tank1PressureBar,
            tank2PressureBar: sample.tank2PressureBar,
            decoCeilingMeters: sample.decoCeilingMeters,
            tankNumber: sample.tankNumber,
          })),
        )
        .returning({ id: diveProfileSamples.id })
      for (const sample of insertedSamples)
        await context.link('dive', item.externalId, 'profile_sample', sample.id)
    }
  }

  for (const item of enabled('tanks') ? snapshot.tanks : []) {
    context.signal.throwIfAborted()
    if (!context.shouldApply('tank', item.externalId)) continue
    const diveId = diveIds.get(item.diveExternalId)
    if (!diveId) continue
    const values = {
      diveId,
      name: item.name,
      sortOrder: item.sortOrder,
      computerTankNumber: item.computerTankNumber,
      volumeLiters: item.volumeLiters,
      startPressureBar: item.startPressureBar,
      endPressureBar: item.endPressureBar,
      workingPressureBar: item.workingPressureBar,
      oxygenPercent: item.oxygenPercent,
      heliumPercent: item.heliumPercent,
      breathingTimeSeconds: item.breathingTimeSeconds,
      weightKg: item.weightKg,
      updatedAt: new Date(),
    }
    const existingId = context.canonicalId('tank', item.externalId, 'tank')
    const [row] = existingId
      ? await tx
          .update(tanks)
          .set(values)
          .where(eq(tanks.id, existingId))
          .returning({ id: tanks.id })
      : await tx.insert(tanks).values(values).returning({ id: tanks.id })
    if (row) await context.link('tank', item.externalId, 'tank', row.id)
  }

  const ownerMissing = (
    entityKey: string,
    externalId: string | null,
    ids: Map<string, string>,
  ) => externalId !== null && !enabled(entityKey) && !ids.has(externalId)
  for (const item of enabled('pictures') ? snapshot.pictures : []) {
    context.signal.throwIfAborted()
    const stored = storedPictures.get(item.externalId)
    const existingId = context.canonicalId('picture', item.externalId, 'picture')
    if (!stored) {
      if (existingId) await tx.delete(pictures).where(eq(pictures.id, existingId))
      await context.unlink('picture', item.externalId, ['picture'])
      continue
    }
    if (!context.shouldApply('picture', item.externalId)) continue
    // A picture of a dive that was not applied — a merge already took it — must
    // not be recreated loose in the gallery.
    if (item.diveExternalId && !diveIds.has(item.diveExternalId)) continue
    // Likewise a picture of a site, person, gear item, or profile that is
    // switched off and was never imported has nowhere to attach.
    if (
      ownerMissing('dive_sites', item.siteExternalId, siteIds) ||
      ownerMissing('buddies', item.buddyExternalId, buddyIds) ||
      ownerMissing('equipment', item.equipmentExternalId, equipmentIds) ||
      ownerMissing('divers', item.diverExternalId, diverIds)
    ) {
      continue
    }
    const referenceValues = {
      diveId: item.diveExternalId ? (diveIds.get(item.diveExternalId) ?? null) : null,
      siteId: item.siteExternalId ? (siteIds.get(item.siteExternalId) ?? null) : null,
      buddyId: item.buddyExternalId ? (buddyIds.get(item.buddyExternalId) ?? null) : null,
      equipmentId: item.equipmentExternalId
        ? (equipmentIds.get(item.equipmentExternalId) ?? null)
        : null,
      diverId: item.diverExternalId ? (diverIds.get(item.diverExternalId) ?? null) : null,
      kind: item.kind,
      path: item.path,
      description: item.description,
      sortOrder: item.sortOrder,
    }
    const values = {
      ...referenceValues,
      storagePath: stored.storagePath,
      thumbnailStoragePath: stored.thumbnailStoragePath,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
      updatedAt: new Date(),
    }
    const [row] = existingId
      ? await tx
          .update(pictures)
          .set(values)
          .where(eq(pictures.id, existingId))
          .returning({ id: pictures.id })
      : await tx.insert(pictures).values(values).returning({ id: pictures.id })
    if (row) await context.link('picture', item.externalId, 'picture', row.id)
  }

  return {
    divers: snapshot.divers.length,
    sites: snapshot.sites.length,
    buddies: snapshot.buddies.length,
    equipment: snapshot.equipment.filter((item) => !item.isSet).length,
    equipmentSets: snapshot.equipment.filter((item) => item.isSet).length,
    certifications: snapshot.certifications.length,
    certificationScans: [...storedCertificationScans.values()].reduce(
      (count, scans) =>
        count + Number(Boolean(scans.scan1)) + Number(Boolean(scans.scan2)),
      0,
    ),
    shops: snapshot.shops.length,
    diveTypes: snapshot.diveTypes.length,
    dives: snapshot.dives.length,
    tanks: snapshot.tanks.length,
    pictures: snapshot.pictures.length,
    pictureFiles: storedPictures.size,
    profileSamples: snapshot.profileSamples.length,
  }
}

async function loadGoogleDriveImages(
  snapshot: DiveMateSnapshot,
  drive: Awaited<ReturnType<typeof openGoogleDriveBackup>>,
  maximumImageBytes: number,
  signal: AbortSignal,
): Promise<ExternalImages> {
  const downloaded = new Map<string, Promise<Uint8Array>>()
  const download = (file: (typeof drive.files)[number]) => {
    const existing = downloaded.get(file.id)
    if (existing) return existing
    const pending = drive.download(file, maximumImageBytes)
    downloaded.set(file.id, pending)
    return pending
  }
  const pictures = new Map<string, { bytes: Uint8Array; mimeType: string }>()
  for (const picture of snapshot.pictures) {
    signal.throwIfAborted()
    if (picture.imageBytes) continue
    const file = findDriveFile(drive.files, picture.path, 'Media')
    if (!file?.mimeType.startsWith('image/')) continue
    pictures.set(picture.externalId, {
      bytes: await download(file),
      mimeType: file.mimeType,
    })
  }

  const certificationScans: ExternalImages['certificationScans'] = new Map()
  for (const certification of snapshot.certifications) {
    signal.throwIfAborted()
    const scans: NonNullable<ReturnType<ExternalImages['certificationScans']['get']>> = {}
    const scan1File = certification.scan1Bytes
      ? null
      : findDriveFile(drive.files, certification.scan1Path)
    const scan2File = certification.scan2Bytes
      ? null
      : findDriveFile(drive.files, certification.scan2Path)
    if (scan1File?.mimeType.startsWith('image/')) {
      scans.scan1 = {
        bytes: await download(scan1File),
        mimeType: scan1File.mimeType,
      }
    }
    if (scan2File?.mimeType.startsWith('image/')) {
      scans.scan2 = {
        bytes: await download(scan2File),
        mimeType: scan2File.mimeType,
      }
    }
    if (scans.scan1 || scans.scan2) {
      certificationScans.set(certification.externalId, scans)
    }
  }
  return { pictures, certificationScans }
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
    const counts = await applySnapshot(
      context.transaction,
      context.prepared.data.snapshot,
      context.prepared.data.storedMedia,
      {
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
              .filter(
                (link) => !options?.excludeMatched || link.role !== MATCHED_LINK_ROLE,
              )
              .map((link) => [link.identityKey, link.canonicalEntityId]),
          )
        },
        shouldApply: (entityType, externalId) =>
          context.findRecord(entityType, externalId).change !== 'unchanged',
        canonicalRole: (entityType, externalId, canonicalEntityType) =>
          context
            .findRecord(entityType, externalId)
            .canonicalLinks.find(
              (link) => link.canonicalEntityType === canonicalEntityType,
            )?.role ?? null,
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
      },
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
