import '@tanstack/react-start/server-only'

import { asc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  buddies,
  diveBuddies,
  diveEquipment,
  diveSites,
  dives,
  diveTypes,
  equipment,
  equipmentSetItems,
  equipmentSets,
  shops,
  tanks,
} from '@/db/schema'

async function loadEditorOptions() {
  const db = getDb()
  const [siteRows, shopRows, typeRows, buddyRows, equipmentRows, setRows] =
    await Promise.all([
      db
        .select({ id: diveSites.id, name: diveSites.name, country: diveSites.country })
        .from(diveSites)
        .orderBy(asc(diveSites.name)),
      db.select({ id: shops.id, name: shops.name }).from(shops).orderBy(asc(shops.name)),
      db
        .select({ id: diveTypes.id, name: diveTypes.name })
        .from(diveTypes)
        .orderBy(sql`${diveTypes.sortOrder} nulls last`, asc(diveTypes.name)),
      db
        .select({
          id: buddies.id,
          firstName: buddies.firstName,
          lastName: buddies.lastName,
        })
        .from(buddies)
        .orderBy(asc(buddies.lastName), asc(buddies.firstName)),
      db
        .select({
          id: equipment.id,
          name: equipment.name,
          category: equipment.category,
          inactive: equipment.inactive,
        })
        .from(equipment)
        .orderBy(asc(equipment.inactive), asc(equipment.category), asc(equipment.name)),
      db
        .select({
          id: equipmentSets.id,
          name: equipmentSets.name,
          inactive: equipmentSets.inactive,
          equipmentId: equipmentSetItems.equipmentId,
          sortOrder: equipmentSetItems.sortOrder,
        })
        .from(equipmentSets)
        .leftJoin(
          equipmentSetItems,
          eq(equipmentSetItems.equipmentSetId, equipmentSets.id),
        )
        .orderBy(
          asc(equipmentSets.inactive),
          asc(equipmentSets.name),
          asc(equipmentSetItems.sortOrder),
        ),
    ])
  const gearSets = new Map<
    string,
    { id: string; name: string; inactive: boolean; equipmentIds: string[] }
  >()
  for (const row of setRows) {
    const set = gearSets.get(row.id) ?? {
      id: row.id,
      name: row.name,
      inactive: row.inactive,
      equipmentIds: [],
    }
    if (row.equipmentId) set.equipmentIds.push(row.equipmentId)
    gearSets.set(row.id, set)
  }
  return {
    sites: siteRows,
    shops: shopRows,
    diveTypes: typeRows,
    buddies: buddyRows,
    equipment: equipmentRows,
    equipmentSets: [...gearSets.values()],
  }
}

export async function loadDiveEditor(diveId: string | null) {
  const db = getDb()
  const [options, [nextNumberRow]] = await Promise.all([
    loadEditorOptions(),
    db
      .select({ nextNumber: sql<number>`coalesce(max(${dives.number}), 0) + 1` })
      .from(dives),
  ])
  const nextNumber = nextNumberRow?.nextNumber ?? 1

  if (!diveId) {
    return { dive: null, tanks: [], buddyIds: [], equipmentIds: [], nextNumber, options }
  }

  const [dive] = await db.select().from(dives).where(eq(dives.id, diveId)).limit(1)
  if (!dive) return null

  const [tankRows, buddyRows, equipmentRows] = await Promise.all([
    db
      .select({
        id: tanks.id,
        name: tanks.name,
        volumeLiters: tanks.volumeLiters,
        oxygenPercent: tanks.oxygenPercent,
        heliumPercent: tanks.heliumPercent,
        startPressureBar: tanks.startPressureBar,
        endPressureBar: tanks.endPressureBar,
      })
      .from(tanks)
      .where(eq(tanks.diveId, diveId))
      .orderBy(sql`${tanks.sortOrder} nulls last`),
    db
      .select({ id: diveBuddies.buddyId })
      .from(diveBuddies)
      .where(eq(diveBuddies.diveId, diveId)),
    db
      .select({ id: diveEquipment.equipmentId })
      .from(diveEquipment)
      .where(eq(diveEquipment.diveId, diveId)),
  ])

  return {
    dive,
    tanks: tankRows,
    buddyIds: buddyRows.map((row) => row.id),
    equipmentIds: equipmentRows.map((row) => row.id),
    nextNumber,
    options,
  }
}
