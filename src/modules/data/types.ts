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

export interface DataListPage {
  records: DataListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
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
  externalUuid: string | null
  sourceUpdatedAt: string | null
  sourcePayload: string | null
  createdAt: string | null
  updatedAt: string
}

export interface DataEditorPayload {
  record: DataEditorRecord | null
  options: Record<string, EditorOption[]>
}
