import { closeDb } from '@/db'
import { syncDiveMate } from '@/modules/divemate/server/sync.server'

try {
  const result = await syncDiveMate()
  console.log(
    `DiveMate sync ${result.runId} completed: ${result.counts.dives ?? 0} dives, ${result.counts.sites ?? 0} sites, ${result.counts.certifications ?? 0} certifications`,
  )
} finally {
  await closeDb()
}
