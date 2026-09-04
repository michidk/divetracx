import { describe, expect, test } from 'bun:test'
import { DEFAULT_DIVEMATE_DIVE_TYPES, normalizeDiveMateDiveTypeName } from './dive-type'

describe('DiveMate dive types', () => {
  test('lists every standard DiveMate type exactly once', () => {
    expect(DEFAULT_DIVEMATE_DIVE_TYPES).toEqual([
      'Freediving',
      'Training',
      'Altitude',
      'Recovery',
      'Boat',
      'Ice',
      'River',
      'Photography',
      'Group leadership',
      'Cave',
      'Night',
      'Navigation',
      'Certification',
      'Student training',
      'Drift',
      'Search',
      'Freshwater',
      'Rescue',
      'Technical',
      'Deep',
      'Wreck',
    ])
    expect(new Set(DEFAULT_DIVEMATE_DIVE_TYPES).size).toBe(
      DEFAULT_DIVEMATE_DIVE_TYPES.length,
    )
  })

  test('translates the built-in German labels from a localized backup', () => {
    expect(
      [
        'Apnoe',
        'Ausbildung',
        'Bergsee',
        'Bergung',
        'Eistauchgang',
        'Flußtauchgang',
        'Fotografie',
        'Gruppenführung',
        'Höhlentauchgang',
        'Nachttauchgang',
        'Prüfungstauchgang',
        'Schülerausbildung',
        'Strömungstauchgang',
        'Suchen',
        'Tauchrettung',
        'Tieftauchgang',
        'Wracktauchgang',
      ].map(normalizeDiveMateDiveTypeName),
    ).toEqual([
      'Freediving',
      'Training',
      'Altitude',
      'Recovery',
      'Ice',
      'River',
      'Photography',
      'Group leadership',
      'Cave',
      'Night',
      'Certification',
      'Student training',
      'Drift',
      'Search',
      'Rescue',
      'Deep',
      'Wreck',
    ])
  })

  test('preserves custom types and accepts localized case differences', () => {
    expect(normalizeDiveMateDiveTypeName('TIEFTAUCHGANG')).toBe('Deep')
    expect(normalizeDiveMateDiveTypeName('Reef survey')).toBe('Reef survey')
  })
})
