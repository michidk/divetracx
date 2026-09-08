import { describe, expect, test } from 'bun:test'
import { DIVEMATE_ENTITIES } from '@/modules/divemate/entities'
import { GARMIN_ENTITIES } from '@/modules/garmin/entities'
import { SUBSURFACE_ENTITIES } from '@/modules/subsurface/entities'
import {
  dependentEntities,
  disabledRecordTypes,
  normalizeDisabledEntities,
  selectableDisabledEntities,
} from './entity-selection'

describe('integration entity selection', () => {
  test('switching off dives takes profiles and tanks with it', () => {
    expect(normalizeDisabledEntities(DIVEMATE_ENTITIES, ['dives'])).toEqual([
      'dives',
      'profile_samples',
      'tanks',
    ])
    expect(dependentEntities(DIVEMATE_ENTITIES, 'dives').map((e) => e.key)).toEqual([
      'profile_samples',
      'tanks',
    ])
    expect(dependentEntities(DIVEMATE_ENTITIES, 'equipment').map((e) => e.key)).toEqual([
      'equipment_sets',
    ])
  })

  test('certifications can be switched off on their own', () => {
    expect(normalizeDisabledEntities(DIVEMATE_ENTITIES, ['certifications'])).toEqual([
      'certifications',
    ])
    expect(dependentEntities(DIVEMATE_ENTITIES, 'certifications')).toEqual([])
    expect([...disabledRecordTypes(DIVEMATE_ENTITIES, ['certifications'])]).toEqual([
      'certification',
    ])
  })

  test('required entities stay on and unknown keys are dropped', () => {
    expect(
      normalizeDisabledEntities(GARMIN_ENTITIES, ['dives', 'gases', 'tanks']),
    ).toEqual(['tanks'])
    expect(
      selectableDisabledEntities(SUBSURFACE_ENTITIES, ['dives', 'buddies', 'nope']),
    ).toEqual(['buddies'])
  })

  test('the stored selection is the owner’s choice, not the widened set', () => {
    expect(selectableDisabledEntities(DIVEMATE_ENTITIES, ['dives'])).toEqual(['dives'])
    expect(
      normalizeDisabledEntities(
        DIVEMATE_ENTITIES,
        selectableDisabledEntities(DIVEMATE_ENTITIES, ['dives']),
      ),
    ).toEqual(['dives', 'profile_samples', 'tanks'])
  })

  test('derived entities without record types skip no records', () => {
    expect([...disabledRecordTypes(GARMIN_ENTITIES, ['profile_samples'])]).toEqual([])
    expect([...disabledRecordTypes(DIVEMATE_ENTITIES, ['dives'])]).toEqual([
      'dive',
      'tank',
    ])
  })

  test('every dependency names a declared entity', () => {
    for (const catalog of [DIVEMATE_ENTITIES, GARMIN_ENTITIES, SUBSURFACE_ENTITIES]) {
      const keys = new Set(catalog.map((entity) => entity.key))
      for (const entity of catalog) {
        for (const dependency of entity.dependsOn ?? []) {
          expect(keys.has(dependency)).toBe(true)
        }
      }
    }
  })
})
