import '@tanstack/react-start/server-only'

import { asc } from 'drizzle-orm'
import { getDb } from '@/db'
import { divers } from '@/db/schema'

/** Personal logbook records (gear, certifications, memberships) belong to the primary diver. */
export async function primaryDiverId() {
  const [diver] = await getDb()
    .select({ id: divers.id })
    .from(divers)
    .orderBy(asc(divers.createdAt))
    .limit(1)
  return diver?.id ?? null
}
