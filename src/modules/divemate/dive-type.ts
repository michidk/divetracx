const GERMAN_DIVE_TYPE_NAMES = new Map([
  ['apnoe', 'Freediving'],
  ['ausbildung', 'Training'],
  ['bergsee', 'Altitude'],
  ['bergseetauchgang', 'Altitude'],
  ['bergung', 'Recovery'],
  ['bootstauchgang', 'Boat'],
  ['eistauchgang', 'Ice'],
  ['flußtauchgang', 'River'],
  ['fototauchgang', 'Photography'],
  ['fotografie', 'Photography'],
  ['gruppenführung', 'Group leadership'],
  ['höhlentauchgang', 'Cave'],
  ['nachttauchgang', 'Night'],
  ['orientierungstauchgang', 'Navigation'],
  ['prüfungstauchgang', 'Certification'],
  ['schülerausbildung', 'Student training'],
  ['strömungstauchgang', 'Drift'],
  ['suchen', 'Search'],
  ['süßwassertauchgang', 'Freshwater'],
  ['tauchrettung', 'Rescue'],
  ['technischer tauchgang', 'Technical'],
  ['tieftauchgang', 'Deep'],
  ['wracktauchgang', 'Wreck'],
])

/** Translate DiveMate's built-in German labels while preserving custom dive types. */
export function normalizeDiveMateDiveTypeName(name: string): string {
  return GERMAN_DIVE_TYPE_NAMES.get(name.toLocaleLowerCase('de-DE')) ?? name
}
