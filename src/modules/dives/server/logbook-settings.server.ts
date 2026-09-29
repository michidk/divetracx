import '@tanstack/react-start/server-only'

import { sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { logbookSettings } from '@/db/schema'

const INSTANCE_ID = 'instance'

/**
 * SQL expression for the number of dives made before this logbook started, so
 * numbering queries read the setting in the same statement they number with.
 */
export const priorDiveCountSql = sql<number>`coalesce((
  select ${logbookSettings.priorDiveCount} from ${logbookSettings}
  where ${logbookSettings.id} = ${INSTANCE_ID}
), 0)`

export async function savePriorDiveCount(priorDiveCount: number) {
  const [row] = await getDb()
    .insert(logbookSettings)
    .values({ id: INSTANCE_ID, priorDiveCount })
    .onConflictDoUpdate({
      target: logbookSettings.id,
      set: { priorDiveCount, updatedAt: new Date() },
    })
    .returning({ priorDiveCount: logbookSettings.priorDiveCount })
  return { priorDiveCount: row?.priorDiveCount ?? priorDiveCount }
}
