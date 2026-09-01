import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import type { ExternalRecordInput } from '../types'

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    )
  }
  return value
}

export function hashExternalRecord(record: ExternalRecordInput) {
  const normalized = stableValue({
    rawPayload: record.rawPayload,
    fileMetadata: record.fileMetadata ?? null,
  })
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
