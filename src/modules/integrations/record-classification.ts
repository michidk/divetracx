import type { ExternalRecordChange, ExternalRecordInput } from './types'

export interface ExistingExternalRecord {
  id: string
  entityType: string
  identityKey: string
  contentHash: string
}

export interface HashedExternalRecordInput extends ExternalRecordInput {
  contentHash: string
}

export interface ClassifiedExternalRecord {
  input: HashedExternalRecordInput
  existingId: string | null
  change: ExternalRecordChange
}

export function externalRecordKey(entityType: string, identityKey: string) {
  return `${entityType}\u0000${identityKey}`
}

export function validateExternalRecordInputs(records: ExternalRecordInput[]) {
  const seen = new Set<string>()
  for (const record of records) {
    if (!record.entityType.trim()) throw new Error('External entity type is required')
    if (!record.identityKey.trim()) throw new Error('External identity key is required')
    const key = externalRecordKey(record.entityType, record.identityKey)
    if (seen.has(key)) {
      throw new Error(
        `Duplicate external record identity ${record.entityType}:${record.identityKey}`,
      )
    }
    seen.add(key)
  }
}

export function classifyExternalRecords(
  existingRecords: ExistingExternalRecord[],
  inputs: HashedExternalRecordInput[],
): ClassifiedExternalRecord[] {
  const existingByKey = new Map(
    existingRecords.map((record) => [
      externalRecordKey(record.entityType, record.identityKey),
      record,
    ]),
  )

  return inputs.map((input) => {
    const existing = existingByKey.get(
      externalRecordKey(input.entityType, input.identityKey),
    )
    if (!existing) return { input, existingId: null, change: 'created' }
    return {
      input,
      existingId: existing.id,
      change: existing.contentHash === input.contentHash ? 'unchanged' : 'updated',
    }
  })
}
