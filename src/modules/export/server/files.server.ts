import '@tanstack/react-start/server-only'

import { buildSubsurfaceExport } from '@/modules/subsurface/exporter'
import { buildCsvExport, buildJsonExport, buildUddfExport } from '../formats'
import type { ExportFile, ExportFormat } from '../types'
import { loadExportSnapshot } from './snapshot.server'

function timestampForFileName(timestamp: string) {
  return timestamp.replaceAll(/[:.]/g, '-')
}

export async function buildExportFile(format: ExportFormat): Promise<ExportFile> {
  const snapshot = await loadExportSnapshot()
  const timestamp = timestampForFileName(snapshot.exportedAt)

  switch (format) {
    case 'json':
      return {
        body: buildJsonExport(snapshot),
        fileName: `divetracx-backup-${timestamp}.json`,
        contentType: 'application/json; charset=utf-8',
      }
    case 'csv':
      return {
        body: buildCsvExport(snapshot),
        fileName: `divetracx-dives-${timestamp}.csv`,
        contentType: 'text/csv; charset=utf-8',
      }
    case 'uddf':
      return {
        body: buildUddfExport(snapshot),
        fileName: `divetracx-logbook-${timestamp}.uddf`,
        contentType: 'application/xml; charset=utf-8',
      }
    case 'subsurface':
      return {
        body: buildSubsurfaceExport(snapshot),
        fileName: `divetracx-logbook-${timestamp}.ssrf`,
        contentType: 'application/xml; charset=utf-8',
      }
  }
}

export async function exportResponse(format: ExportFormat) {
  const file = await buildExportFile(format)
  return new Response(file.body, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Content-Type': file.contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
