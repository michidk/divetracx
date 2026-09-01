import { describe, expect, test } from 'bun:test'
import { isGarminDiveActivity, parseGarminActivityDetails } from './activity-details'

describe('Garmin Activity Details', () => {
  test('accepts documented PascalCase Activity Details fields', () => {
    const details = parseGarminActivityDetails({
      ActivityId: 12345,
      SummaryId: 'summary-1',
      InsertedDate: '2026-09-01T09:00:00Z',
      Summary: {
        ActivityId: 12345,
        ActivityType: 'singleGasDiving',
        StartTimeInSeconds: 1_788_251_400,
        StartTimeOffsetInSeconds: 7_200,
        DurationInSeconds: 2_700,
        StartingLatitudeInDegree: 28.123,
      },
    })

    expect(details.activityId).toBe('12345')
    expect(details.summary.durationInSeconds).toBe(2_700)
    expect(isGarminDiveActivity(details)).toBe(true)
  })

  test('rejects Activity Details without a stable ActivityId', () => {
    expect(() => parseGarminActivityDetails({ Summary: {} })).toThrow('ActivityId')
  })
})
