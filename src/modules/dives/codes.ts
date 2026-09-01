// DiveMate stores water and entry as numeric codes; 0 means "not set".
// Unknown codes are preserved for import round-trips and shown as "Code N".

export const WATER_TYPE_OPTIONS = [
  { code: 1, label: 'Salt water' },
  { code: 2, label: 'Fresh water' },
] as const

export const ENTRY_TYPE_OPTIONS = [
  { code: 1, label: 'Shore' },
  { code: 2, label: 'Boat' },
] as const

function codeLabel(
  options: ReadonlyArray<{ code: number; label: string }>,
  code: number | null,
) {
  if (code === null || code === 0) return null
  return options.find((option) => option.code === code)?.label ?? `Code ${code}`
}

export function waterTypeLabel(code: number | null) {
  return codeLabel(WATER_TYPE_OPTIONS, code)
}

export function entryTypeLabel(code: number | null) {
  return codeLabel(ENTRY_TYPE_OPTIONS, code)
}
