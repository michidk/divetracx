import { basename } from 'node:path'
import { closeDb } from '@/db'
import { importSubsurfaceUpload } from '@/modules/integrations/server/operations.server'

const path = Bun.argv
  .find((value) => value.startsWith('--file='))
  ?.slice('--file='.length)
if (!path) throw new Error('Use --file=path/to/logbook.ssrf')

try {
  const xml = await Bun.file(path).text()
  const result = await importSubsurfaceUpload({ fileName: basename(path), xml })
  console.log(
    `subsurface import ${result.runId}: ${result.records.discovered} discovered, ${result.records.created} new, ${result.records.updated} changed, ${result.records.skipped} unchanged`,
  )
} finally {
  await closeDb()
}
