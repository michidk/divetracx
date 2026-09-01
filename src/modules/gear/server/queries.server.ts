import '@tanstack/react-start/server-only'

import { asc, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { diveEquipment, diveSites, dives, equipment } from '@/db/schema'

export async function loadGearOverview() {
  const db = getDb()
  return db
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
    .orderBy(asc(equipment.inactive), asc(equipment.category), asc(equipment.name))
}

export async function loadGearDetail(gearId: string) {
  const db = getDb()
  const [item] = await db
    .select()
    .from(equipment)
    .where(eq(equipment.id, gearId))
    .limit(1)
  if (!item) return null

  const gearDives = await db
    .select({
      id: dives.id,
      number: dives.number,
      diveDate: dives.diveDate,
      durationSeconds: dives.durationSeconds,
      maximumDepthMeters: dives.maximumDepthMeters,
      siteName: diveSites.name,
    })
    .from(diveEquipment)
    .innerJoin(dives, eq(diveEquipment.diveId, dives.id))
    .leftJoin(diveSites, eq(dives.siteId, diveSites.id))
    .where(eq(diveEquipment.equipmentId, gearId))
    .orderBy(desc(dives.diveDate), desc(dives.entryTime))

  return { item, dives: gearDives }
}
