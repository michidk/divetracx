import { closeDb } from '@/db'
import { probeGarminDiveApi } from '@/modules/garmin/server/dive-probe.server'

try {
  const result = await probeGarminDiveApi()
  for (const step of result.steps) {
    console.log(`${step.ok ? 'OK  ' : 'FAIL'} ${step.name}: ${step.detail}`)
    if (step.sample) console.log(step.sample)
  }
} finally {
  await closeDb()
}
