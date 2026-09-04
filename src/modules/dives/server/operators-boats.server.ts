import '@tanstack/react-start/server-only'

import { and, asc, count, eq, ilike, ne } from 'drizzle-orm'
import { getDb } from '@/db'
import { boats, dives, externalRecordLinks, shops } from '@/db/schema'

export type OperationTaxonomy = 'operator' | 'boat'

function taxonomyName(value: string, label: string) {
  const name = value.trim()
  if (!name) throw new Error(`${label} name is required`)
  if (name.length > 120) throw new Error(`${label} name is too long`)
  return name
}

export async function loadOperatorsAndBoats() {
  const db = getDb()
  const [operators, boatRows] = await Promise.all([
    db
      .select({
        id: shops.id,
        name: shops.name,
        diveCount: count(dives.id).mapWith(Number),
      })
      .from(shops)
      .leftJoin(dives, eq(dives.shopId, shops.id))
      .groupBy(shops.id)
      .orderBy(asc(shops.name)),
    db
      .select({
        id: boats.id,
        name: boats.name,
        diveCount: count(dives.id).mapWith(Number),
      })
      .from(boats)
      .leftJoin(dives, eq(dives.boatId, boats.id))
      .groupBy(boats.id)
      .orderBy(asc(boats.name)),
  ])
  return { operators, boats: boatRows }
}

export async function createOperationTaxonomy(
  taxonomy: OperationTaxonomy,
  value: string,
) {
  const label = taxonomy === 'operator' ? 'Dive operator' : 'Boat'
  const name = taxonomyName(value, label)
  const table = taxonomy === 'operator' ? shops : boats
  const [existing] = await getDb()
    .select({ name: table.name })
    .from(table)
    .where(ilike(table.name, name))
    .limit(1)
  if (existing) throw new Error(`${existing.name} already exists`)

  const [created] = await getDb().insert(table).values({ name }).returning()
  if (!created) throw new Error(`${label} could not be created`)
  return created
}

export async function renameOperationTaxonomy(
  taxonomy: OperationTaxonomy,
  id: string,
  value: string,
) {
  const label = taxonomy === 'operator' ? 'Dive operator' : 'Boat'
  const name = taxonomyName(value, label)
  const table = taxonomy === 'operator' ? shops : boats
  const [duplicate] = await getDb()
    .select({ name: table.name })
    .from(table)
    .where(and(ilike(table.name, name), ne(table.id, id)))
    .limit(1)
  if (duplicate) throw new Error(`${duplicate.name} already exists`)

  const [updated] = await getDb()
    .update(table)
    .set({ name, updatedAt: new Date() })
    .where(eq(table.id, id))
    .returning()
  if (!updated) throw new Error(`${label} was not found`)
  return updated
}

export async function deleteOperationTaxonomy(taxonomy: OperationTaxonomy, id: string) {
  const label = taxonomy === 'operator' ? 'Dive operator' : 'Boat'
  const table = taxonomy === 'operator' ? shops : boats
  const diveReference = taxonomy === 'operator' ? dives.shopId : dives.boatId

  return getDb().transaction(async (transaction) => {
    const [record] = await transaction
      .select({ name: table.name, diveCount: count(dives.id).mapWith(Number) })
      .from(table)
      .leftJoin(dives, eq(diveReference, table.id))
      .where(eq(table.id, id))
      .groupBy(table.id)
      .limit(1)
    if (!record) throw new Error(`${label} was not found`)
    if (record.diveCount > 0) {
      throw new Error(
        `${record.name} is used by ${record.diveCount} ${record.diveCount === 1 ? 'dive' : 'dives'} and cannot be deleted`,
      )
    }

    if (taxonomy === 'operator') {
      await transaction
        .delete(externalRecordLinks)
        .where(
          and(
            eq(externalRecordLinks.canonicalEntityType, 'shop'),
            eq(externalRecordLinks.canonicalEntityId, id),
          ),
        )
    }
    await transaction.delete(table).where(eq(table.id, id))
    return { id }
  })
}
