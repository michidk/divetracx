/**
 * Subsurface has free-form dive tags where Divetracx has a dive type, an entry
 * type code, and a decompression flag. Tags travel both ways through these
 * helpers; unmatched tags stay in the import provenance record.
 */

const SHORE_ENTRY_CODE = 1
const BOAT_ENTRY_CODE = 2
const ENTRY_TAGS = new Map([
  ['shore', SHORE_ENTRY_CODE],
  ['boat', BOAT_ENTRY_CODE],
])
const DECO_TAG = 'deco'

function normalizeTag(value: string) {
  return value
    .trim()
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .toLocaleLowerCase('en-US')
}

export function entryTypeFromTags(tags: string[]) {
  for (const tag of tags) {
    const code = ENTRY_TAGS.get(normalizeTag(tag))
    if (code !== undefined) return code
  }
  return null
}

export function decompressionFromTags(tags: string[]) {
  return tags.some((tag) => normalizeTag(tag) === DECO_TAG)
}

/** Picks the first tag naming an existing dive type; nothing is created. */
export function matchDiveTypeFromTags<T extends { id: string; name: string }>(
  tags: string[],
  diveTypes: T[],
) {
  const byName = new Map(diveTypes.map((type) => [normalizeTag(type.name), type]))
  for (const tag of tags) {
    const match = byName.get(normalizeTag(tag))
    if (match) return match
  }
  return null
}

export function tagsForExport(dive: {
  diveTypeName: string | null
  entryType: number | null
  decompressionDive: boolean
}) {
  const tags: string[] = []
  if (dive.diveTypeName) tags.push(dive.diveTypeName.trim().toLocaleLowerCase('en-US'))
  for (const [tag, code] of ENTRY_TAGS) {
    if (dive.entryType === code) tags.push(tag)
  }
  if (dive.decompressionDive) tags.push(DECO_TAG)
  return [...new Set(tags.filter(Boolean))]
}
