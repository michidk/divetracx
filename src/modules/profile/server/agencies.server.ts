import '@tanstack/react-start/server-only'

import { asc, desc, eq } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import { getDb } from '@/db'
import { agencies } from '@/db/schema'
import { findAgencyByName, normalizedAgencyName } from '@/modules/profile/agency-catalog'

type AgencyDatabase = ReturnType<typeof getDb> | DatabaseTransaction

export async function loadAgencies(database: AgencyDatabase = getDb()) {
  return database
    .select()
    .from(agencies)
    .orderBy(desc(agencies.builtIn), asc(agencies.name))
}

export async function createCustomAgency(name: string) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Agency name is required')
  if (trimmedName.length > 120) throw new Error('Agency name is too long')
  const catalogAgency = findAgencyByName(trimmedName)
  if (catalogAgency) throw new Error(`${catalogAgency.shortName} already exists`)

  const normalizedName = normalizedAgencyName(trimmedName)
  const [created] = await getDb()
    .insert(agencies)
    .values({ name: trimmedName, normalizedName })
    .onConflictDoNothing({ target: agencies.normalizedName })
    .returning()
  if (created) return created

  const [existing] = await getDb()
    .select()
    .from(agencies)
    .where(eq(agencies.normalizedName, normalizedName))
    .limit(1)
  if (!existing) throw new Error('Agency could not be created')
  throw new Error(`${existing.name} already exists`)
}

export async function deleteCustomAgency(agencyId: string) {
  const [agency] = await getDb()
    .select({ id: agencies.id, name: agencies.name, builtIn: agencies.builtIn })
    .from(agencies)
    .where(eq(agencies.id, agencyId))
    .limit(1)
  if (!agency) throw new Error('Agency was not found')
  if (agency.builtIn) throw new Error('Built-in agencies cannot be deleted')

  try {
    await getDb().delete(agencies).where(eq(agencies.id, agency.id))
  } catch (error) {
    const cause =
      typeof error === 'object' && error !== null && 'cause' in error ? error.cause : null
    if (
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23503') ||
      (typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        cause.code === '23503')
    ) {
      throw new Error(
        `${agency.name} is used by a membership or certification and cannot be deleted`,
      )
    }
    throw error
  }
}

export async function resolveAgencyId(
  database: AgencyDatabase,
  organization: string | null | undefined,
) {
  const name = organization?.trim()
  if (!name) return null

  const builtIn = findAgencyByName(name)
  if (builtIn) {
    const [agency] = await database
      .select({ id: agencies.id })
      .from(agencies)
      .where(eq(agencies.code, builtIn.code))
      .limit(1)
    if (!agency) throw new Error(`Built-in agency ${builtIn.shortName} is missing`)
    return agency.id
  }

  const normalizedName = normalizedAgencyName(name)
  const [created] = await database
    .insert(agencies)
    .values({ name, normalizedName })
    .onConflictDoNothing({ target: agencies.normalizedName })
    .returning({ id: agencies.id })
  if (created) return created.id

  const [existing] = await database
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.normalizedName, normalizedName))
    .limit(1)
  if (!existing) throw new Error('Agency could not be resolved')
  return existing.id
}
