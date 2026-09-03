import { describe, expect, test } from 'bun:test'
import { adjacentDiveDates, diveStartEpochSeconds, selectNearestDive } from './matching'

const target = Date.parse('2026-08-14T07:32:10Z') / 1_000

function candidate(
  id: string,
  entryTime: string | null,
  utcOffsetMinutes: number | null = 120,
  diveDate = '2026-08-14',
) {
  return { id, diveDate, entryTime, utcOffsetMinutes }
}

describe('diveStartEpochSeconds', () => {
  test('converts local date and time with the stored offset', () => {
    expect(diveStartEpochSeconds(candidate('a', '09:32:10', 120), null)).toBe(target)
  })

  test('falls back to the activity offset when the dive has none', () => {
    expect(diveStartEpochSeconds(candidate('a', '09:32:10', null), 120)).toBe(target)
    expect(diveStartEpochSeconds(candidate('a', '07:32:10', null), null)).toBe(target)
  })

  test('cannot place a dive without an entry time', () => {
    expect(diveStartEpochSeconds(candidate('a', null), 120)).toBeNull()
  })
})

describe('selectNearestDive', () => {
  test('picks the nearest dive within the tolerance', () => {
    const match = selectNearestDive(
      [
        candidate('early', '08:50:00'),
        candidate('close', '09:35:00'),
        candidate('later', '11:00:00'),
      ],
      target,
      null,
    )
    expect(match).toEqual({ diveId: 'close', differenceSeconds: 170 })
  })

  test('returns null when everything is outside the tolerance', () => {
    expect(selectNearestDive([candidate('far', '15:00:00')], target, null)).toBeNull()
    expect(selectNearestDive([], target, null)).toBeNull()
  })

  test('ignores candidates without an entry time', () => {
    expect(selectNearestDive([candidate('unplaced', null)], target, null)).toBeNull()
  })

  test('honors an explicit tolerance', () => {
    expect(
      selectNearestDive([candidate('close', '09:35:00')], target, null, 60),
    ).toBeNull()
  })
})

describe('adjacentDiveDates', () => {
  test('returns the previous, same, and next calendar dates', () => {
    expect(adjacentDiveDates('2026-08-14')).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
    ])
    expect(adjacentDiveDates('2026-01-01')).toEqual([
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ])
  })
})
