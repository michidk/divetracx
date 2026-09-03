import { closeDb } from '@/db'
import {
  type DiveMateSyncTrigger,
  syncDiveMate,
} from '@/modules/divemate/server/sync.server'

function syncTrigger(): DiveMateSyncTrigger {
  const argument = Bun.argv.find((value) => value.startsWith('--trigger='))
  const trigger = argument?.slice('--trigger='.length) ?? 'cli'
  if (trigger === 'cli' || trigger === 'manual' || trigger === 'schedule') {
    return trigger
  }
  throw new Error(`Unsupported sync trigger: ${trigger}`)
}

try {
  const result = await syncDiveMate({ trigger: syncTrigger() })
  console.log(
    `DiveMate sync ${result.runId} completed: ${result.counts.dive ?? 0} dives, ${result.counts.profileSamples ?? 0} profile samples, ${result.counts.dive_site ?? 0} sites, ${result.counts.certification ?? 0} certifications, ${result.counts.picture ?? 0} picture references`,
  )
} finally {
  await closeDb()
}
