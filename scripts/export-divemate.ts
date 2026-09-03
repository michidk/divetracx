import { resolve } from 'node:path'
import { writeBackDiveMate } from '@/modules/divemate/server/writeback.server'

const outputArgument = process.argv.find((value) => value.startsWith('--output='))
const outputPath = resolve(
  outputArgument?.slice('--output='.length) || 'backups/DiveMate.ddb',
)
const result = await writeBackDiveMate({ upload: false, outputPath })

console.log(
  `Exported ${result.updatedRecords} DiveMate records to ${outputPath} (${result.skippedLocalRecords} local-only records skipped).`,
)
