import '@tanstack/react-start/server-only'

import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  diveEquipment,
  diveSites,
  dives,
  diveTypes,
  equipment,
  equipmentSetItems,
  equipmentSets,
  pictures,
} from '@/db/schema'

export async function loadGearOverview() {
  const db = getDb()
  const [items, sets] = await Promise.all([
    db
      .select({
        id: equipment.id,
        name: equipment.name,
        category: equipment.category,
        manufacturer: equipment.manufacturer,
        model: equipment.model,
        serviceDueAt: equipment.serviceDueAt,
        retiredAt: equipment.retiredAt,
        inactive: equipment.inactive,
        diveCount: sql<number>`count(${dives.id})::integer`,
        lastUsedDate: sql<string | null>`max(${dives.diveDate})`,
      })
      .from(equipment)
      .leftJoin(diveEquipment, eq(diveEquipment.equipmentId, equipment.id))
      .leftJoin(dives, eq(diveEquipment.diveId, dives.id))
      .groupBy(equipment.id)
      .orderBy(asc(equipment.inactive), asc(equipment.category), asc(equipment.name)),
    db
      .select({
        id: equipmentSets.id,
        name: equipmentSets.name,
        notes: equipmentSets.notes,
        inactive: equipmentSets.inactive,
        memberCount: sql<number>`count(${equipmentSetItems.equipmentId})::integer`,
      })
      .from(equipmentSets)
      .leftJoin(equipmentSetItems, eq(equipmentSetItems.equipmentSetId, equipmentSets.id))
      .groupBy(equipmentSets.id)
      .orderBy(asc(equipmentSets.inactive), asc(equipmentSets.name)),
  ])
  return { items, sets }
}

export async function loadGearSetEditor(gearSetId: string | null) {
  const db = getDb()
  const itemOptions = await db
    .select({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      inactive: equipment.inactive,
    })
    .from(equipment)
    .orderBy(asc(equipment.inactive), asc(equipment.category), asc(equipment.name))
  if (!gearSetId) return { set: null, equipment: itemOptions, equipmentIds: [] }

  const [set] = await db
    .select()
    .from(equipmentSets)
    .where(eq(equipmentSets.id, gearSetId))
    .limit(1)
  if (!set) return null
  const members = await db
    .select({ id: equipmentSetItems.equipmentId })
    .from(equipmentSetItems)
    .where(eq(equipmentSetItems.equipmentSetId, gearSetId))
    .orderBy(asc(equipmentSetItems.sortOrder))
  return { set, equipment: itemOptions, equipmentIds: members.map((member) => member.id) }
}

export async function loadGearDetail(gearId: string) {
  const db = getDb()
  const [item] = await db
    .select()
    .from(equipment)
    .where(eq(equipment.id, gearId))
    .limit(1)
  if (!item) return null

  const [gearDives, gearPictures] = await Promise.all([
    db
      .select({
        id: dives.id,
        number: dives.number,
        diveDate: dives.diveDate,
        durationSeconds: dives.durationSeconds,
        maximumDepthMeters: dives.maximumDepthMeters,
        siteName: diveSites.name,
        diveTypeName: diveTypes.name,
      })
      .from(diveEquipment)
      .innerJoin(dives, eq(diveEquipment.diveId, dives.id))
      .leftJoin(diveSites, eq(dives.siteId, diveSites.id))
      .leftJoin(diveTypes, eq(dives.diveTypeId, diveTypes.id))
      .where(eq(diveEquipment.equipmentId, gearId))
      .orderBy(desc(dives.diveDate), desc(dives.entryTime)),
    db
      .select({
        id: pictures.id,
        path: pictures.path,
        storagePath: pictures.storagePath,
        thumbnailStoragePath: pictures.thumbnailStoragePath,
        description: pictures.description,
      })
      .from(pictures)
      .where(
        and(
          eq(pictures.equipmentId, gearId),
          eq(pictures.kind, 'photo'),
          isNotNull(pictures.storagePath),
        ),
      )
      .orderBy(sql`${pictures.sortOrder} nulls last`, asc(pictures.path)),
  ])

  return { item, dives: gearDives, pictures: gearPictures }
}
