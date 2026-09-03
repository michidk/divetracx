import '@tanstack/react-start/server-only'

import { and, asc, count, eq, ilike, ne, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { dives, diveTypes, externalRecordLinks } from '@/db/schema'

function diveTypeName(value: string) {
  const name = value.trim()
  if (!name) throw new Error('Dive type name is required')
  if (name.length > 120) throw new Error('Dive type name is too long')
  return name
}

export async function loadDiveTypes() {
  return getDb()
    .select({
      id: diveTypes.id,
      name: diveTypes.name,
      sortOrder: diveTypes.sortOrder,
      diveCount: count(dives.id).mapWith(Number),
    })
    .from(diveTypes)
    .leftJoin(dives, eq(dives.diveTypeId, diveTypes.id))
    .groupBy(diveTypes.id)
    .orderBy(sql`${diveTypes.sortOrder} nulls last`, asc(diveTypes.name))
}

export async function createDiveType(value: string) {
  const name = diveTypeName(value)
  const [existing] = await getDb()
    .select({ id: diveTypes.id, name: diveTypes.name })
    .from(diveTypes)
    .where(ilike(diveTypes.name, name))
    .limit(1)
  if (existing) throw new Error(`${existing.name} already exists`)

  const [created] = await getDb().insert(diveTypes).values({ name }).returning()
  if (!created) throw new Error('Dive type could not be created')
  return created
}

export async function renameDiveType(id: string, value: string) {
  const name = diveTypeName(value)
  const [duplicate] = await getDb()
    .select({ name: diveTypes.name })
    .from(diveTypes)
    .where(and(ilike(diveTypes.name, name), ne(diveTypes.id, id)))
    .limit(1)
  if (duplicate) throw new Error(`${duplicate.name} already exists`)

  const [updated] = await getDb()
    .update(diveTypes)
    .set({ name, updatedAt: new Date() })
    .where(eq(diveTypes.id, id))
    .returning()
  if (!updated) throw new Error('Dive type was not found')
  return updated
}

export async function deleteDiveType(id: string) {
  return getDb().transaction(async (transaction) => {
    const [type] = await transaction
      .select({ name: diveTypes.name, diveCount: count(dives.id).mapWith(Number) })
      .from(diveTypes)
      .leftJoin(dives, eq(dives.diveTypeId, diveTypes.id))
      .where(eq(diveTypes.id, id))
      .groupBy(diveTypes.id)
      .limit(1)
    if (!type) throw new Error('Dive type was not found')
    if (type.diveCount > 0) {
      throw new Error(
        `${type.name} is used by ${type.diveCount} ${type.diveCount === 1 ? 'dive' : 'dives'} and cannot be deleted`,
      )
    }

    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'dive_type'),
          eq(externalRecordLinks.canonicalEntityId, id),
        ),
      )
    await transaction.delete(diveTypes).where(eq(diveTypes.id, id))
    return { id }
  })
}
