import '@tanstack/react-start/server-only'

import { desc } from 'drizzle-orm'
import { getDb } from '@/db'
import { syncRuns } from '@/db/schema'

export async function loadSyncLogs() {
  return getDb()
    .select({
      id: syncRuns.id,
      trigger: syncRuns.trigger,
      status: syncRuns.status,
      startedAt: syncRuns.startedAt,
      finishedAt: syncRuns.finishedAt,
      sourceFingerprint: syncRuns.sourceFingerprint,
      counts: syncRuns.counts,
      error: syncRuns.error,
    })
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(50)
}
