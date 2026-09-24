import '@tanstack/react-start/server-only'

import { asc, eq, inArray } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import {
  boats,
  buddies,
  buddyAgencyMemberships,
  certifications,
  diveBuddies,
  diveEquipment,
  diveProfileSamples,
  divers,
  diveSites,
  dives,
  diveTypes,
  equipment,
  equipmentSetItems,
  equipmentSets,
  pictures,
  shops,
  tanks,
} from '@/db/schema'
import type { DiveBuddyRole } from '@/modules/dives/buddy-role'
import { MATCHED_LINK_ROLE } from '@/modules/integrations/types'
import { resolveAgencyId } from '@/modules/profile/server/agencies.server'
import { parseDiveMateDiveTeam } from '../dive-team'
import { DEFAULT_DIVEMATE_DIVE_TYPES } from '../dive-type'
import {
  cleanDiveMateInstructorName,
  formatDiveMateInstructor,
  normalizeDiveMateInstructorName,
} from '../instructor'
import type { DiveMateSnapshot } from '../types'
import type { StoredDiveMateMedia, StoredImage } from './media.server'

export interface SnapshotApplyContext {
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

export async function ensureDiveMateDiveTypes(transaction: DatabaseTransaction) {
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

/**
 * A switched-off entity still resolves for the records that point at it, but
 * only to rows an earlier run already linked; nothing new is created for it.
 */
function referenceIds(
  context: SnapshotApplyContext,
  entityKey: string,
  entityType: string,
) {
  return context.isEntityEnabled(entityKey)
    ? Promise.resolve(new Map<string, string>())
    : context.previouslyLinkedIds(entityType, entityType)
}

async function applyDivers(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
): Promise<Map<string, string>> {
  const diverIds = await referenceIds(context, 'divers', 'diver')
  for (const item of context.isEntityEnabled('divers') ? snapshot.divers : []) {
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
  return diverIds
}

async function applySites(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
): Promise<Map<string, string>> {
  const siteIds = await referenceIds(context, 'dive_sites', 'dive_site')
  for (const item of context.isEntityEnabled('dive_sites') ? snapshot.sites : []) {
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
  return siteIds
}

async function applyBuddies(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
): Promise<Map<string, string>> {
  const buddyIds = await referenceIds(context, 'buddies', 'buddy')
  for (const item of context.isEntityEnabled('buddies') ? snapshot.buddies : []) {
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
  return buddyIds
}

async function applyEquipment(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
  diverIds: ReadonlyMap<string, string>,
): Promise<Map<string, string>> {
  const equipmentIds = await referenceIds(context, 'equipment', 'equipment')
  const equipmentItems = context.isEntityEnabled('equipment')
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
  return equipmentIds
}

async function applyEquipmentSets(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
  equipmentIds: ReadonlyMap<string, string>,
) {
  const equipmentSetSources = context.isEntityEnabled('equipment_sets')
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
}

async function applyShops(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
): Promise<Map<string, string>> {
  const shopIds = await referenceIds(context, 'shops', 'shop')
  for (const item of context.isEntityEnabled('shops') ? snapshot.shops : []) {
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
  return shopIds
}

async function applyDiveTypes(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
): Promise<Map<string, string>> {
  const diveTypeIdsByName = new Map(
    (
      await tx
        .select({ id: diveTypes.id, name: diveTypes.name })
        .from(diveTypes)
        .orderBy(asc(diveTypes.createdAt))
    ).map((diveType) => [diveType.name.trim().toLocaleLowerCase('en-US'), diveType.id]),
  )
  const diveTypeIds = await referenceIds(context, 'dive_types', 'dive_type')
  for (const item of context.isEntityEnabled('dive_types') ? snapshot.diveTypes : []) {
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
  return diveTypeIds
}

async function applyCertifications(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
  diverIds: ReadonlyMap<string, string>,
  namedBuddy: (importedName: string | null) => Promise<string | null>,
  storedCertificationScans: ReadonlyMap<
    string,
    { scan1?: StoredImage; scan2?: StoredImage }
  >,
) {
  for (const item of context.isEntityEnabled('certifications')
    ? snapshot.certifications
    : []) {
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
}

async function applyDiveBuddyRoles(
  tx: DatabaseTransaction,
  context: SnapshotApplyContext,
  diveId: string,
  externalId: string,
  item: DiveMateSnapshot['dives'][number],
  buddyIds: ReadonlyMap<string, string>,
  namedBuddy: (importedName: string | null) => Promise<string | null>,
) {
  const oldBuddyLinks = context.canonicalIds('dive', externalId, 'dive_buddy')
  if (oldBuddyLinks.length > 0)
    await tx.delete(diveBuddies).where(inArray(diveBuddies.id, oldBuddyLinks))
  await context.unlink('dive', externalId, ['dive_buddy'])
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
        .values({ diveId, buddyId, role })
        .onConflictDoUpdate({
          target: [diveBuddies.diveId, diveBuddies.buddyId],
          set: { role },
        })
        .returning({ id: diveBuddies.id })
      if (association)
        await context.link('dive', externalId, 'dive_buddy', association.id)
    }
  }
}

async function applyDiveEquipmentLinks(
  tx: DatabaseTransaction,
  context: SnapshotApplyContext,
  diveId: string,
  externalId: string,
  item: DiveMateSnapshot['dives'][number],
  snapshot: DiveMateSnapshot,
  equipmentIds: ReadonlyMap<string, string>,
) {
  const oldEquipmentLinks = context.canonicalIds('dive', externalId, 'dive_equipment')
  if (oldEquipmentLinks.length > 0)
    await tx.delete(diveEquipment).where(inArray(diveEquipment.id, oldEquipmentLinks))
  await context.unlink('dive', externalId, ['dive_equipment'])
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
        .values({ diveId, equipmentId })
        .onConflictDoUpdate({
          target: [diveEquipment.diveId, diveEquipment.equipmentId],
          set: { equipmentId },
        })
        .returning({ id: diveEquipment.id })
      if (association)
        await context.link('dive', externalId, 'dive_equipment', association.id)
    }
  }
}

async function applyDiveProfileSamplesFor(
  tx: DatabaseTransaction,
  context: SnapshotApplyContext,
  diveId: string,
  externalId: string,
  importedProfileSamples: DiveMateSnapshot['profileSamples'],
) {
  const oldProfileSamples = context.canonicalIds('dive', externalId, 'profile_sample')
  if (oldProfileSamples.length > 0)
    await tx
      .delete(diveProfileSamples)
      .where(inArray(diveProfileSamples.id, oldProfileSamples))
  await context.unlink('dive', externalId, ['profile_sample'])
  if (importedProfileSamples.length > 0) {
    const insertedSamples = await tx
      .insert(diveProfileSamples)
      .values(
        importedProfileSamples.map((sample) => ({
          diveId,
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
      await context.link('dive', externalId, 'profile_sample', sample.id)
  }
}

interface ApplyDivesDeps {
  diverIds: ReadonlyMap<string, string>
  siteIds: ReadonlyMap<string, string>
  shopIds: ReadonlyMap<string, string>
  diveTypeIds: ReadonlyMap<string, string>
  buddyIds: ReadonlyMap<string, string>
  namedBuddy: (importedName: string | null) => Promise<string | null>
  equipmentIds: ReadonlyMap<string, string>
  profileSamplesByDive: ReadonlyMap<string, DiveMateSnapshot['profileSamples']>
}

/**
 * A matched dive belongs to the logbook rather than to this backup — it was
 * merged into another dive, or already existed here. Leaving it out of
 * `diveIds` also keeps its tanks and pictures from landing on the dive that
 * absorbed it.
 */
async function applyDives(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
  deps: ApplyDivesDeps,
): Promise<Map<string, string>> {
  const enabled = context.isEntityEnabled
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
    : await context.previouslyLinkedIds('dive', 'dive', { excludeMatched: true })

  for (const item of enabled('dives') ? snapshot.dives : []) {
    context.signal.throwIfAborted()
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
      diverId: item.diverExternalId
        ? (deps.diverIds.get(item.diverExternalId) ?? null)
        : null,
      siteId: item.siteExternalId
        ? (deps.siteIds.get(item.siteExternalId) ?? null)
        : null,
      shopId: item.shopExternalId
        ? (deps.shopIds.get(item.shopExternalId) ?? null)
        : null,
      boatId: sourceBoatName ? boatId : null,
      diveTypeId: item.diveTypeExternalId
        ? (deps.diveTypeIds.get(item.diveTypeExternalId) ?? null)
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

    await applyDiveBuddyRoles(
      tx,
      context,
      row.id,
      item.externalId,
      item,
      deps.buddyIds,
      deps.namedBuddy,
    )
    await applyDiveEquipmentLinks(
      tx,
      context,
      row.id,
      item.externalId,
      item,
      snapshot,
      deps.equipmentIds,
    )

    // With profiles switched off a changed dive keeps the samples it already
    // has; replacing them with nothing would be a deletion.
    if (enabled('profile_samples')) {
      const importedProfileSamples = deps.profileSamplesByDive.get(item.externalId) ?? []
      await applyDiveProfileSamplesFor(
        tx,
        context,
        row.id,
        item.externalId,
        importedProfileSamples,
      )
    }
  }
  return diveIds
}

async function applyTanks(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
  diveIds: ReadonlyMap<string, string>,
) {
  for (const item of context.isEntityEnabled('tanks') ? snapshot.tanks : []) {
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
}

interface ApplyPicturesDeps {
  diveIds: ReadonlyMap<string, string>
  siteIds: ReadonlyMap<string, string>
  buddyIds: ReadonlyMap<string, string>
  equipmentIds: ReadonlyMap<string, string>
  diverIds: ReadonlyMap<string, string>
  storedPictures: ReadonlyMap<string, StoredImage>
}

async function applyPictures(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  context: SnapshotApplyContext,
  deps: ApplyPicturesDeps,
) {
  const enabled = context.isEntityEnabled
  // A picture of a site, person, gear item, or profile that is switched off
  // and was never imported has nowhere to attach.
  const ownerMissing = (
    entityKey: string,
    externalId: string | null,
    ids: ReadonlyMap<string, string>,
  ) => externalId !== null && !enabled(entityKey) && !ids.has(externalId)
  for (const item of enabled('pictures') ? snapshot.pictures : []) {
    context.signal.throwIfAborted()
    const stored = deps.storedPictures.get(item.externalId)
    const existingId = context.canonicalId('picture', item.externalId, 'picture')
    if (!stored) {
      if (existingId) await tx.delete(pictures).where(eq(pictures.id, existingId))
      await context.unlink('picture', item.externalId, ['picture'])
      continue
    }
    if (!context.shouldApply('picture', item.externalId)) continue
    // A picture of a dive that was not applied — a merge already took it —
    // must not be recreated loose in the gallery.
    if (item.diveExternalId && !deps.diveIds.has(item.diveExternalId)) continue
    if (
      ownerMissing('dive_sites', item.siteExternalId, deps.siteIds) ||
      ownerMissing('buddies', item.buddyExternalId, deps.buddyIds) ||
      ownerMissing('equipment', item.equipmentExternalId, deps.equipmentIds) ||
      ownerMissing('divers', item.diverExternalId, deps.diverIds)
    ) {
      continue
    }
    const referenceValues = {
      diveId: item.diveExternalId
        ? (deps.diveIds.get(item.diveExternalId) ?? null)
        : null,
      siteId: item.siteExternalId
        ? (deps.siteIds.get(item.siteExternalId) ?? null)
        : null,
      buddyId: item.buddyExternalId
        ? (deps.buddyIds.get(item.buddyExternalId) ?? null)
        : null,
      equipmentId: item.equipmentExternalId
        ? (deps.equipmentIds.get(item.equipmentExternalId) ?? null)
        : null,
      diverId: item.diverExternalId
        ? (deps.diverIds.get(item.diverExternalId) ?? null)
        : null,
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
}

/**
 * Applies a parsed DiveMate snapshot to the canonical schema as a staged
 * pipeline: each stage receives only the ID maps it depends on and returns
 * the map it produces, so a later stage's prerequisites are visible in its
 * signature instead of in mutable variables declared far above it.
 */
export async function applySnapshot(
  tx: DatabaseTransaction,
  snapshot: DiveMateSnapshot,
  storedMedia: StoredDiveMateMedia,
  context: SnapshotApplyContext,
) {
  const storedPictures = storedMedia.pictures
  const storedCertificationScans = storedMedia.certificationScans
  const enabled = context.isEntityEnabled

  const diverIds = await applyDivers(tx, snapshot, context)
  const siteIds = await applySites(tx, snapshot, context)
  const buddyIds = await applyBuddies(tx, snapshot, context)

  const buddyIdsByName = await loadBuddyNameIndex(tx)
  // With buddies switched off, a name on a dive or certification still attaches
  // to a person already in the logbook but never creates a new one.
  const namedBuddy = (importedName: string | null) =>
    resolveNamedBuddy(tx, buddyIdsByName, importedName, enabled('buddies'))

  const equipmentIds = await applyEquipment(tx, snapshot, context, diverIds)
  await applyEquipmentSets(tx, snapshot, context, equipmentIds)
  const shopIds = await applyShops(tx, snapshot, context)
  const diveTypeIds = await applyDiveTypes(tx, snapshot, context)
  await applyCertifications(
    tx,
    snapshot,
    context,
    diverIds,
    namedBuddy,
    storedCertificationScans,
  )

  const profileSamplesByDive = new Map<string, DiveMateSnapshot['profileSamples']>()
  for (const sample of enabled('profile_samples') ? snapshot.profileSamples : []) {
    context.signal.throwIfAborted()
    const samples = profileSamplesByDive.get(sample.diveExternalId) ?? []
    samples.push(sample)
    profileSamplesByDive.set(sample.diveExternalId, samples)
  }

  const diveIds = await applyDives(tx, snapshot, context, {
    diverIds,
    siteIds,
    shopIds,
    diveTypeIds,
    buddyIds,
    namedBuddy,
    equipmentIds,
    profileSamplesByDive,
  })
  await applyTanks(tx, snapshot, context, diveIds)
  await applyPictures(tx, snapshot, context, {
    diveIds,
    siteIds,
    buddyIds,
    equipmentIds,
    diverIds,
    storedPictures,
  })

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
