const GERMAN_DIVE_TYPE_NAMES = new Map([
  ['ausbildung', 'Training'],
  ['bergseetauchgang', 'Altitude dive'],
  ['bootstauchgang', 'Boat dive'],
  ['eistauchgang', 'Ice dive'],
  ['fototauchgang', 'Photography dive'],
  ['höhlentauchgang', 'Cave dive'],
  ['nachttauchgang', 'Night dive'],
  ['orientierungstauchgang', 'Navigation dive'],
  ['strömungstauchgang', 'Drift dive'],
  ['süßwassertauchgang', 'Freshwater dive'],
  ['technischer tauchgang', 'Technical dive'],
  ['tieftauchgang', 'Deep dive'],
  ['wracktauchgang', 'Wreck dive'],
])

/** Translate DiveMate's built-in German labels while preserving custom dive types. */
export function normalizeDiveMateDiveTypeName(name: string): string {
  return GERMAN_DIVE_TYPE_NAMES.get(name.toLocaleLowerCase('de-DE')) ?? name
}
