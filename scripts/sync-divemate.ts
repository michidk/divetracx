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
    `DiveMate sync ${result.runId} completed: ${result.counts.dives ?? 0} dives, ${result.counts.sites ?? 0} sites, ${result.counts.certifications ?? 0} certifications`,
  )
} finally {
  await closeDb()
}
