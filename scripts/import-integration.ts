import { closeDb } from '@/db'
import { runIntegrationImport } from '@/modules/integrations/server/operations.server'

function option(name: string) {
  return Bun.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
}

const integration = option('integration')
if (integration !== 'divemate' && integration !== 'garmin') {
  throw new Error(
    'Use --integration=divemate or --integration=garmin (Subsurface files import with import:subsurface)',
  )
}
const trigger = option('trigger') ?? 'cli'
if (trigger !== 'cli' && trigger !== 'schedule' && trigger !== 'manual') {
  throw new Error('Use --trigger=cli, --trigger=schedule, or --trigger=manual')
}

try {
  const result = await runIntegrationImport(integration, 'incremental', trigger)
  console.log(
    `${integration} incremental import ${result.runId}: ${result.records.discovered} discovered, ${result.records.created} new, ${result.records.updated} changed, ${result.records.skipped} unchanged, ${result.records.failed} failed`,
  )
} finally {
  await closeDb()
}
