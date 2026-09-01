import '@tanstack/react-start/server-only'

import { desc } from 'drizzle-orm'
import { getDb } from '@/db'
import { syncRuns } from '@/db/schema'
import { getServerEnv } from '@/env'

export async function loadSyncStatus() {
  const [latestRun] = await getDb()
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1)

  return {
    configured: Boolean(getServerEnv().DIVEMATE_GOOGLE_DRIVE_FOLDER_ID),
    latestRun: latestRun ?? null,
  }
}
