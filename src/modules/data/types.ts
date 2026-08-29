import type { EditorValues, EntityKey } from './entities'

export interface DataOverviewItem {
  entity: EntityKey
  count: number
}

export interface DataListItem {
  id: string
  title: string
  subtitle: string | null
  detail: string | null
  sourceKey: string
  updatedAt: string
}

export interface EditorOption {
  value: string
  label: string
}

export interface DataEditorRecord {
  id: string
  values: EditorValues
  sourceKey: string
  externalId: string | null
  updatedAt: string
}

export interface DataEditorPayload {
  record: DataEditorRecord | null
  options: Record<string, EditorOption[]>
}
