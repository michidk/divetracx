import { describe, expect, test } from 'bun:test'
import { mapGarminActivity } from './mapping'

describe('Garmin canonical mapping', () => {
  test('maps a dive from Activity Details without DiveMate assumptions', () => {
    const mapped = mapGarminActivity({
      activityDetails: {
        ActivityId: 12345,
        Summary: {
          ActivityId: 12345,
          ActivityType: 'diving',
          ActivityName: 'Blue Hole',
          DeviceName: 'Descent Mk3',
          StartTimeInSeconds: Date.parse('2026-09-01T08:30:00Z') / 1_000,
          StartTimeOffsetInSeconds: 7_200,
          DurationInSeconds: 2_400,
          MaximumDepthInMeters: 28.4,
          AverageDepthInMeters: 14.2,
          StartingLatitudeInDegree: 28.5721,
          StartingLongitudeInDegree: -80.648,
        },
      },
    })

    expect(mapped).toMatchObject({
      externalId: '12345',
      diveDate: '2026-09-01',
      entryTime: '10:30:00',
      utcOffsetMinutes: 120,
      durationSeconds: 2_400,
      maximumDepthMeters: 28.4,
      computer: 'Descent Mk3',
      latitude: 28.5721,
    })
  })

  test('ignores non-diving Garmin activities', () => {
    expect(
      mapGarminActivity({
        activityDetails: {
          ActivityId: 9,
          Summary: {
            ActivityType: 'running',
            StartTimeInSeconds: 1_700_000_000,
          },
        },
      }),
    ).toBeNull()
  })
})
