import '@tanstack/react-start/server-only'

import { and, eq, inArray } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import {
  agencyMemberships,
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
import type { ObservedExternalRecord } from '@/modules/integrations/types'
import { MATCHED_LINK_ROLE } from '@/modules/integrations/types'
import { SOURCE_KEY } from './constants'

export const canonicalTableBySourceType = {
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

export type DirectCanonicalSourceType = keyof typeof canonicalTableBySourceType

export function isDirectCanonicalSourceType(
  value: string,
): value is DirectCanonicalSourceType {
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
export async function linkExportedCanonicalRecords(
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

async function repointRemainingProvenance(
  transaction: DatabaseTransaction,
  repair: RoundTripDuplicate,
) {
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

/**
 * One relationship-migration-and-deletion operation per entity type: move
 * whatever the duplicate owns onto the original, repoint any remaining
 * provenance, then delete the duplicate row. Registered in a table so the
 * order of repair stays an explicit list (`REPAIR_ORDER`) rather than an
 * implicit sequence of inline blocks.
 */
type RepairHandler = (
  transaction: DatabaseTransaction,
  repair: RoundTripDuplicate,
  records: ObservedExternalRecord[],
) => Promise<void>

const simpleDeleteRepairHandler = (
  entityType: 'picture' | 'tank' | 'certification',
): RepairHandler => {
  return async (transaction, repair) => {
    await repointRemainingProvenance(transaction, repair)
    await transaction
      .delete(canonicalTableBySourceType[entityType])
      .where(eq(canonicalTableBySourceType[entityType].id, repair.duplicateId))
  }
}

const repairHandlers: Record<DirectCanonicalSourceType, RepairHandler> = {
  async equipment_set(transaction, repair) {
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
    await repointRemainingProvenance(transaction, repair)
    await transaction
      .delete(equipmentSets)
      .where(eq(equipmentSets.id, repair.duplicateId))
  },
  async equipment(transaction, repair) {
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
    await repointRemainingProvenance(transaction, repair)
    await transaction.delete(equipment).where(eq(equipment.id, repair.duplicateId))
  },
  async buddy(transaction, repair) {
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
    await repointRemainingProvenance(transaction, repair)
    await transaction.delete(buddies).where(eq(buddies.id, repair.duplicateId))
  },
  async dive_site(transaction, repair) {
    await transaction
      .update(dives)
      .set({ siteId: repair.originalId })
      .where(eq(dives.siteId, repair.duplicateId))
    await transaction
      .update(pictures)
      .set({ siteId: repair.originalId })
      .where(eq(pictures.siteId, repair.duplicateId))
    await repointRemainingProvenance(transaction, repair)
    await transaction.delete(diveSites).where(eq(diveSites.id, repair.duplicateId))
  },
  async shop(transaction, repair) {
    await transaction
      .update(dives)
      .set({ shopId: repair.originalId })
      .where(eq(dives.shopId, repair.duplicateId))
    await repointRemainingProvenance(transaction, repair)
    await transaction.delete(shops).where(eq(shops.id, repair.duplicateId))
  },
  async dive_type(transaction, repair) {
    await transaction
      .update(dives)
      .set({ diveTypeId: repair.originalId })
      .where(eq(dives.diveTypeId, repair.duplicateId))
    await repointRemainingProvenance(transaction, repair)
    await transaction.delete(diveTypes).where(eq(diveTypes.id, repair.duplicateId))
  },
  async diver(transaction, repair) {
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
    await repointRemainingProvenance(transaction, repair)
    await transaction.delete(divers).where(eq(divers.id, repair.duplicateId))
  },
  picture: simpleDeleteRepairHandler('picture'),
  tank: simpleDeleteRepairHandler('tank'),
  certification: simpleDeleteRepairHandler('certification'),
  async dive(transaction, repair, records) {
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
    await repointRemainingProvenance(transaction, repair)
    await transaction.delete(dives).where(eq(dives.id, repair.duplicateId))
  },
}

/** The fixed order duplicate repair runs its per-entity-type handlers in. */
const REPAIR_ORDER: DirectCanonicalSourceType[] = [
  'equipment_set',
  'equipment',
  'buddy',
  'dive_site',
  'shop',
  'dive_type',
  'diver',
  'picture',
  'tank',
  'certification',
  'dive',
]

/**
 * Repair canonical copies created by the old write-back implementation. It
 * changed numeric DiveMate IDs even though those IDs are import identities,
 * but it also wrote the canonical UUID into every exported row. Prefer that
 * exact key while it survives. If a later broken write-back replaced it, use
 * the same stable natural keys the import contract already uses (entity name,
 * or the unique dive number), limited to rows owned by this integration.
 */
export async function repairRoundTripDuplicates(
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

  for (const entityType of REPAIR_ORDER) {
    for (const repair of byType.get(entityType) ?? []) {
      await repairHandlers[entityType](transaction, repair, records)
    }
  }
  return [...byType.values()].reduce((total, entries) => total + entries.length, 0)
}

export async function pruneDiscardedDives(
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
