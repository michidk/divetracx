import { describe, expect, test } from 'bun:test'
import {
  type DiveSiteMapRecord,
  groupSitesByCoordinates,
  mapSiteCoordinates,
  matchesSiteSearch,
} from './map-sites'

function site(values: Partial<DiveSiteMapRecord> = {}): DiveSiteMapRecord {
  return {
    id: 'site-1',
    name: 'Blue Hole',
    country: 'Belize',
    region: null,
    waterName: 'Caribbean Sea',
    latitude: '17.3150000',
    longitude: '-87.5340000',
    maximumDepthMeters: null,
    altitudeMeters: null,
    difficulty: null,
    rating: null,
    diveCount: 2,
    deepestMeters: '32.00',
    latestDive: null,
    ...values,
  }
}

describe('dive site map helpers', () => {
  test('accepts valid geographic coordinates and rejects invalid values', () => {
    expect(mapSiteCoordinates(site())).toMatchObject({
      latitudeValue: 17.315,
      longitudeValue: -87.534,
    })
    expect(mapSiteCoordinates(site({ latitude: null }))).toBeNull()
    expect(mapSiteCoordinates(site({ latitude: '91' }))).toBeNull()
    expect(mapSiteCoordinates(site({ longitude: '-181' }))).toBeNull()
  })

  test('groups multiple dive spots at the same coordinate', () => {
    const first = mapSiteCoordinates(site())
    const second = mapSiteCoordinates(site({ id: 'site-2', name: 'The Wall' }))
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    if (!first || !second) throw new Error('Expected valid mapped sites')

    const groups = groupSitesByCoordinates([first, second])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.sites.map((item) => item.name)).toEqual(['Blue Hole', 'The Wall'])
  })

  test('searches names and geographic labels case-insensitively', () => {
    const record = site()
    expect(matchesSiteSearch(record, 'blue')).toBe(true)
    expect(matchesSiteSearch(record, 'CARIBBEAN')).toBe(true)
    expect(matchesSiteSearch(record, 'pacific')).toBe(false)
  })
})
