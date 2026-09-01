import { describe, expect, test } from 'bun:test'
import {
  activityStartEpochSeconds,
  activityUtcOffsetSeconds,
  buildActivityDetails,
  isAfterWatermark,
  isDiveActivity,
  nextAdapterState,
  parseAdapterState,
} from './envelope'

const diveActivity = {
  activityId: 19283746,
  activityName: 'Shark Reef',
  activityType: { typeId: 144, typeKey: 'single_gas_diving' },
  startTimeGMT: '2026-08-14 07:32:10',
  startTimeLocal: '2026-08-14 09:32:10',
  beginTimestamp: 1_786_951_930_000,
  duration: 2_712.4,
  startLatitude: 27.7312,
  startLongitude: 34.2521,
  maxDepth: 28.4,
}

describe('isDiveActivity', () => {
  test('accepts diving sub-sports and rejects other activity types', () => {
    expect(isDiveActivity(diveActivity)).toBe(true)
    expect(isDiveActivity({ activityType: { typeKey: 'apnea_diving' } })).toBe(true)
    expect(isDiveActivity({ activityType: { typeKey: 'street_running' } })).toBe(false)
    expect(isDiveActivity({})).toBe(false)
  })
})

describe('activity timestamps', () => {
  test('prefers beginTimestamp and falls back to startTimeGMT', () => {
    expect(activityStartEpochSeconds(diveActivity)).toBe(1_786_951_930)
    expect(activityStartEpochSeconds({ startTimeGMT: '2026-08-14 07:32:10' })).toBe(
      Date.parse('2026-08-14T07:32:10Z') / 1_000,
    )
    expect(activityStartEpochSeconds({})).toBeNull()
  })

  test('derives the UTC offset from local and GMT start times', () => {
    expect(activityUtcOffsetSeconds(diveActivity)).toBe(2 * 3_600)
    expect(activityUtcOffsetSeconds({ startTimeGMT: '2026-08-14 07:32:10' })).toBeNull()
  })
})

describe('buildActivityDetails', () => {
  test('normalizes the summary fields the Divetracx connector reads', () => {
    const details = buildActivityDetails(diveActivity)
    expect(details).toMatchObject({
      activityId: '19283746',
      activityType: 'single_gas_diving',
      activityName: 'Shark Reef',
      startTimeInSeconds: 1_786_951_930,
      startTimeOffsetInSeconds: 7_200,
      durationInSeconds: 2_712,
      startingLatitudeInDegree: 27.7312,
      startingLongitudeInDegree: 34.2521,
    })
    expect(details.maxDepth).toBe(28.4)
  })

  test('rejects activities without an identity', () => {
    expect(() => buildActivityDetails({ activityName: 'nameless' })).toThrow(
      'missing an activityId',
    )
  })
})

describe('adapter state', () => {
  test('round-trips the watermark and advances it monotonically', () => {
    expect(parseAdapterState({})).toEqual({ lastActivityStartSeconds: null })
    expect(parseAdapterState({ lastActivityStartSeconds: 1_700 })).toEqual({
      lastActivityStartSeconds: 1_700,
    })
    expect(
      nextAdapterState({ lastActivityStartSeconds: 2_000 }, [1_500, null, 1_900]),
    ).toEqual({ lastActivityStartSeconds: 2_000 })
    expect(nextAdapterState({ lastActivityStartSeconds: null }, [1_500, 1_900])).toEqual({
      lastActivityStartSeconds: 1_900,
    })
    expect(nextAdapterState({ lastActivityStartSeconds: null }, [null])).toEqual({
      lastActivityStartSeconds: null,
    })
  })

  test('keeps activities newer than the watermark minus the overlap', () => {
    const watermark = { lastActivityStartSeconds: 10_000 }
    expect(isAfterWatermark(9_500, watermark, 3_600)).toBe(true)
    expect(isAfterWatermark(6_400, watermark, 3_600)).toBe(false)
    expect(isAfterWatermark(null, watermark, 3_600)).toBe(true)
    expect(isAfterWatermark(1, { lastActivityStartSeconds: null }, 3_600)).toBe(true)
  })
})
