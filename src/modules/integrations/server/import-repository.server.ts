import '@tanstack/react-start/server-only'

import { eq, inArray, sql } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import {
  buddies,
  certifications,
  diveBuddies,
  diveEquipment,
  diveProfileSamples,
  divers,
  diveSites,
  dives,
  diveTypes,
  equipment,
  equipmentSets,
  externalRecordLinks,
  externalRecords,
  integrationState,
  pictures,
  shops,
  tanks,
} from '@/db/schema'
import {
  classifyExternalRecords,
  validateExternalRecordInputs,
} from '../record-classification'
import {
  type CanonicalRecordLink,
  type ExternalRecordInput,
  MATCHED_LINK_ROLE,
  type ObservedExternalRecord,
} from '../types'
import { hashExternalRecord } from './record-hash.server'

const CANONICAL_DELETE_ORDER = [
  'picture',
  'certification',
  'profile_sample',
  'tank',
  'dive_buddy',
  'dive_equipment',
  'dive',
  'equipment_set',
  'equipment',
  'buddy',
  'shop',
  'dive_type',
  'dive_site',
  'diver',
] as const

type CanonicalEntityType = (typeof CANONICAL_DELETE_ORDER)[number]

function isCanonicalEntityType(value: string): value is CanonicalEntityType {
  return CANONICAL_DELETE_ORDER.some((candidate) => candidate === value)
}

async function deleteCanonicalRows(
  transaction: DatabaseTransaction,
  entityType: CanonicalEntityType,
  ids: string[],
) {
  if (ids.length === 0) return
  switch (entityType) {
    case 'picture':
      await transaction.delete(pictures).where(inArray(pictures.id, ids))
      return
    case 'certification':
      await transaction.delete(certifications).where(inArray(certifications.id, ids))
      return
    case 'profile_sample':
      await transaction
        .delete(diveProfileSamples)
        .where(inArray(diveProfileSamples.id, ids))
      return
    case 'tank':
      await transaction.delete(tanks).where(inArray(tanks.id, ids))
      return
    case 'dive_buddy':
      await transaction.delete(diveBuddies).where(inArray(diveBuddies.id, ids))
      return
    case 'dive_equipment':
      await transaction.delete(diveEquipment).where(inArray(diveEquipment.id, ids))
      return
    case 'dive':
      await transaction.delete(dives).where(inArray(dives.id, ids))
      return
    case 'equipment_set':
      await transaction.delete(equipmentSets).where(inArray(equipmentSets.id, ids))
      return
    case 'equipment':
      await transaction.delete(equipment).where(inArray(equipment.id, ids))
      return
    case 'buddy':
      await transaction.delete(buddies).where(inArray(buddies.id, ids))
      return
    case 'shop':
      await transaction.delete(shops).where(inArray(shops.id, ids))
      return
    case 'dive_type':
      await transaction.delete(diveTypes).where(inArray(diveTypes.id, ids))
      return
    case 'dive_site':
      await transaction.delete(diveSites).where(inArray(diveSites.id, ids))
      return
    case 'diver':
      await transaction.delete(divers).where(inArray(divers.id, ids))
      return
  }
}

export async function acquireImportLock(transaction: DatabaseTransaction) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtext('divetracx:canonical-import'))`,
  )
}

export async function replaceImportedCanonicalDataset(transaction: DatabaseTransaction) {
  const allLinks = await transaction
    .select({
      canonicalEntityType: externalRecordLinks.canonicalEntityType,
      canonicalEntityId: externalRecordLinks.canonicalEntityId,
      role: externalRecordLinks.role,
    })
    .from(externalRecordLinks)
  // Matched records existed before any import and were only enriched;
  // replacing the imported dataset must leave them in place.
  const links = allLinks.filter((link) => link.role !== MATCHED_LINK_ROLE)

  const unknownTypes = [
    ...new Set(
      links
        .map((link) => link.canonicalEntityType)
        .filter((entityType) => !isCanonicalEntityType(entityType)),
    ),
  ]
  if (unknownTypes.length > 0) {
    throw new Error(
      `Full import cannot safely replace unknown canonical provenance types: ${unknownTypes.join(', ')}`,
    )
  }

  const idsByType = new Map<CanonicalEntityType, Set<string>>()
  for (const link of links) {
    if (!isCanonicalEntityType(link.canonicalEntityType)) continue
    const ids = idsByType.get(link.canonicalEntityType) ?? new Set<string>()
    ids.add(link.canonicalEntityId)
    idsByType.set(link.canonicalEntityType, ids)
  }

  for (const entityType of CANONICAL_DELETE_ORDER) {
    await deleteCanonicalRows(transaction, entityType, [
      ...(idsByType.get(entityType) ?? []),
    ])
  }

  await transaction.delete(externalRecords)
  await transaction
    .update(integrationState)
    .set({ state: {}, lastSuccessfulRunId: null, updatedAt: new Date() })
}

export async function observeExternalRecords(
  transaction: DatabaseTransaction,
  integrationKey: string,
  runId: string,
  inputs: ExternalRecordInput[],
): Promise<ObservedExternalRecord[]> {
  validateExternalRecordInputs(inputs)
  const hashedInputs = inputs.map((input) => ({
    ...input,
    contentHash: input.contentHash ?? hashExternalRecord(input),
  }))
  const existing = await transaction
    .select({
      id: externalRecords.id,
      entityType: externalRecords.entityType,
      identityKey: externalRecords.identityKey,
      contentHash: externalRecords.contentHash,
    })
    .from(externalRecords)
    .where(eq(externalRecords.integrationKey, integrationKey))
  const classified = classifyExternalRecords(existing, hashedInputs)
  const observedAt = new Date()
  const observed: ObservedExternalRecord[] = []

  for (const record of classified) {
    if (record.change === 'created') {
      const [inserted] = await transaction
        .insert(externalRecords)
        .values({
          integrationKey,
          entityType: record.input.entityType,
          identityKey: record.input.identityKey,
          externalId: record.input.externalId ?? null,
          rawPayload: record.input.rawPayload,
          fileMetadata: record.input.fileMetadata ?? null,
          contentHash: record.input.contentHash,
          externalCreatedAt: record.input.externalCreatedAt ?? null,
          externalUpdatedAt: record.input.externalUpdatedAt ?? null,
          firstSeenAt: observedAt,
          lastSeenAt: observedAt,
          firstSeenRunId: runId,
          lastSeenRunId: runId,
          mapperVersion: record.input.mapperVersion ?? 1,
        })
        .returning({ id: externalRecords.id })
      if (!inserted) throw new Error('Could not create an external record')
      observed.push({
        id: inserted.id,
        input: record.input,
        change: record.change,
        canonicalLinks: [],
      })
      continue
    }

    if (!record.existingId) throw new Error('External record classification lost its ID')
    const values =
      record.change === 'unchanged'
        ? { lastSeenAt: observedAt, lastSeenRunId: runId }
        : {
            externalId: record.input.externalId ?? null,
            rawPayload: record.input.rawPayload,
            fileMetadata: record.input.fileMetadata ?? null,
            contentHash: record.input.contentHash,
            externalCreatedAt: record.input.externalCreatedAt ?? null,
            externalUpdatedAt: record.input.externalUpdatedAt ?? null,
            lastSeenAt: observedAt,
            lastSeenRunId: runId,
            mapperVersion: record.input.mapperVersion ?? 1,
            processingError: null,
          }
    await transaction
      .update(externalRecords)
      .set(values)
      .where(eq(externalRecords.id, record.existingId))
    observed.push({
      id: record.existingId,
      input: record.input,
      change: record.change,
      canonicalLinks: [],
    })
  }

  const recordIds = observed.map((record) => record.id)
  const links: Array<CanonicalRecordLink & { externalRecordId: string }> =
    recordIds.length === 0
      ? []
      : await transaction
          .select({
            externalRecordId: externalRecordLinks.externalRecordId,
            canonicalEntityType: externalRecordLinks.canonicalEntityType,
            canonicalEntityId: externalRecordLinks.canonicalEntityId,
            role: externalRecordLinks.role,
          })
          .from(externalRecordLinks)
          .where(inArray(externalRecordLinks.externalRecordId, recordIds))
  const observedById = new Map(observed.map((record) => [record.id, record]))
  for (const link of links) {
    observedById.get(link.externalRecordId)?.canonicalLinks.push(link)
  }
  return observed
}

export async function markExternalRecordsProcessed(
  transaction: DatabaseTransaction,
  records: ObservedExternalRecord[],
) {
  const processedIds = records
    .filter((record) => record.change !== 'unchanged')
    .map((record) => record.id)
  if (processedIds.length === 0) return
  await transaction
    .update(externalRecords)
    .set({ processedAt: new Date(), processingError: null })
    .where(inArray(externalRecords.id, processedIds))
}
