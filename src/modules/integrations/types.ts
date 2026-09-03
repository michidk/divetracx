import type { DatabaseTransaction } from '@/db'

export type ImportMode = 'full' | 'incremental'
export type ImportTrigger = 'manual' | 'schedule' | 'cli'
export interface IntegrationCapabilities {
  fullImport: boolean
  incrementalImport: boolean
  export: boolean
}

export interface IntegrationDescriptor {
  key: string
  displayName: string
  capabilities: IntegrationCapabilities
  supportedEntities: string[]
}

export interface ExternalRecordInput {
  entityType: string
  identityKey: string
  externalId?: string | null
  rawPayload: Record<string, unknown>
  fileMetadata?: Record<string, unknown> | null
  contentHash?: string
  externalCreatedAt?: Date | null
  externalUpdatedAt?: Date | null
  mapperVersion?: number
}

export type ExternalRecordChange = 'created' | 'updated' | 'unchanged'

export interface ObservedExternalRecord {
  id: string
  input: ExternalRecordInput
  change: ExternalRecordChange
  canonicalLinks: CanonicalRecordLink[]
}

/**
 * Link role for canonical records that existed before an import observed them
 * and were only enriched, never produced, by the integration. A full import
 * must not delete records whose only provenance is a matched link.
 */
export const MATCHED_LINK_ROLE = 'matched'

export interface CanonicalRecordLink {
  canonicalEntityType: string
  canonicalEntityId: string
  role: string
}

export interface PreparedImport<TData = unknown> {
  records: ExternalRecordInput[]
  data: TData
  nextState: Record<string, unknown>
  validation: {
    complete: boolean
    sourceDescription: string
  }
  sourceFingerprint?: string | null
  diagnostics?: Record<string, unknown>
}

export interface PrepareImportContext {
  mode: ImportMode
  state: Record<string, unknown>
  signal: AbortSignal
}

export interface CanonicalChangeCounts {
  created: number
  updated: number
  skipped: number
  byEntity?: Record<string, number>
}

export interface ApplyImportContext<TData> {
  transaction: DatabaseTransaction
  mode: ImportMode
  runId: string
  signal: AbortSignal
  prepared: PreparedImport<TData>
  records: ObservedExternalRecord[]
  findRecord(entityType: string, identityKey: string): ObservedExternalRecord
  findCanonicalId(
    entityType: string,
    identityKey: string,
    canonicalEntityType: string,
  ): string | null
  linkCanonicalRecord(
    externalRecordId: string,
    canonicalEntityType: string,
    canonicalEntityId: string,
    role?: string,
  ): Promise<void>
  unlinkCanonicalRecords(
    externalRecordId: string,
    canonicalEntityTypes: string[],
  ): Promise<void>
}

export interface IntegrationExport {
  body: Uint8Array | string
  fileName: string
  contentType: string
}

export interface IntegrationConnector<TData = unknown> {
  descriptor: IntegrationDescriptor
  prepareImport(context: PrepareImportContext): Promise<PreparedImport<TData>>
  applyImport(context: ApplyImportContext<TData>): Promise<CanonicalChangeCounts>
  export?(): Promise<IntegrationExport>
}

export interface PerformImportOptions {
  trigger: ImportTrigger
}

export interface ImportResult {
  runId: string
  integrationKey: string
  mode: ImportMode
  status: 'succeeded'
  sourceFingerprint: string | null
  records: {
    discovered: number
    created: number
    updated: number
    skipped: number
    failed: number
  }
  canonical: CanonicalChangeCounts
  diagnostics: Record<string, unknown>
}
