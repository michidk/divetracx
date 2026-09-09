import { describe, expect, test } from 'bun:test'
import type { FileIdMesg, RecordMesg, SessionMesg } from '@garmin/fitsdk'
import { Encoder, Profile } from '@garmin/fitsdk'
import { mapGarminActivity } from './mapping'

function messageNumber(name: string) {
  const value = Profile.MesgNum[name]
  if (value === undefined) throw new Error(`FIT profile is missing ${name}`)
  return value
}

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

  test('summarises heart rate from the session, or from the samples when absent', () => {
    const startedAt = new Date('2026-09-01T10:00:00Z')
    const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1_000)
    const encodeFit = (session: Record<string, unknown>) => {
      const encoder = new Encoder()
      encoder.onMesg(messageNumber('FILE_ID'), {
        type: 'activity',
        manufacturer: 'development',
        product: 1,
        timeCreated: startedAt,
      } as FileIdMesg)
      encoder.onMesg(messageNumber('SESSION'), {
        sport: 'diving',
        subSport: 'singleGasDiving',
        startTime: startedAt,
        timestamp: at(20),
        totalTimerTime: 20,
        event: 'session',
        eventType: 'stop',
        ...session,
      } as SessionMesg)
      for (const [seconds, heartRate] of [
        [0, 80],
        [10, 100],
        [20, 90],
      ] as const) {
        encoder.onMesg(messageNumber('RECORD'), {
          timestamp: at(seconds),
          depth: 5,
          heartRate,
        } as RecordMesg)
      }
      return encoder.close()
    }
    const details = {
      activityDetails: {
        ActivityId: 7,
        Summary: {
          ActivityId: 7,
          ActivityType: 'diving',
          StartTimeInSeconds: startedAt.getTime() / 1_000,
        },
      },
    }

    const fromSession = mapGarminActivity({
      ...details,
      fitBytes: encodeFit({ avgHeartRate: 95, maxHeartRate: 120 }),
    })
    expect(fromSession).toMatchObject({
      averageHeartRateBpm: 95,
      maximumHeartRateBpm: 120,
    })

    const fromSamples = mapGarminActivity({ ...details, fitBytes: encodeFit({}) })
    expect(fromSamples).toMatchObject({
      averageHeartRateBpm: 90,
      maximumHeartRateBpm: 100,
    })
    expect(fromSamples?.profileSamples.map((sample) => sample.heartRateBpm)).toEqual([
      80, 100, 90,
    ])
  })

  test('takes the deco flag and gas roles from the Dive service summary', () => {
    const startedAt = new Date('2026-09-01T10:00:00Z')
    const encoder = new Encoder()
    encoder.onMesg(messageNumber('FILE_ID'), {
      type: 'activity',
      manufacturer: 'development',
      product: 1,
      timeCreated: startedAt,
    } as FileIdMesg)
    encoder.onMesg(messageNumber('SESSION'), {
      sport: 'diving',
      subSport: 'multiGasDiving',
      startTime: startedAt,
      timestamp: new Date(startedAt.getTime() + 60_000),
      totalTimerTime: 60,
      event: 'session',
      eventType: 'stop',
    } as SessionMesg)
    encoder.onMesg(messageNumber('DIVE_GAS'), {
      messageIndex: 0,
      oxygenContent: 21,
      heliumContent: 0,
      status: 'enabled',
    } as never)
    encoder.onMesg(messageNumber('DIVE_GAS'), {
      messageIndex: 1,
      oxygenContent: 50,
      heliumContent: 0,
      status: 'enabled',
    } as never)
    encoder.onMesg(messageNumber('RECORD'), {
      timestamp: startedAt,
      depth: 5,
    } as RecordMesg)

    const mapped = mapGarminActivity({
      activityDetails: {
        activityId: '9',
        activityType: 'multi_gas_diving',
        startTimeInSeconds: startedAt.getTime() / 1_000,
        isDeco: true,
        gases: [
          { gasStatus: 'BOTTOM_GAS', percentOxygen: 21, percentHelium: 0 },
          { gasStatus: 'DECO_ENABLED', percentOxygen: 50, percentHelium: 0 },
        ],
      },
      fitBytes: encoder.close(),
    })
    expect(mapped?.decompressionDive).toBe(true)
    expect(mapped?.gases.map((gas) => gas.role)).toEqual(['bottom', 'deco'])
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
