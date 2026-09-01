import { describe, expect, test } from 'bun:test'
import type { FileIdMesg, FitMessages, RecordMesg, SessionMesg } from '@garmin/fitsdk'
import { Encoder, Profile } from '@garmin/fitsdk'
import { decodeGarminFit, mapDecodedGarminFit } from './fit'

function messageNumber(name: string) {
  const value = Profile.MesgNum[name]
  if (value === undefined) throw new Error(`FIT profile is missing ${name}`)
  return value
}

describe('Garmin FIT mapping', () => {
  test('maps diving sessions, profile samples, gas and decompression fields', () => {
    const startedAt = new Date('2026-09-01T10:00:00Z')
    const mapped = mapDecodedGarminFit({
      sessionMesgs: [
        {
          sport: 'diving',
          subSport: 'singleGasDiving',
          startTime: startedAt,
          totalTimerTime: 120,
        },
      ],
      recordMesgs: [
        {
          timestamp: startedAt,
          depth: 0,
          temperature: 24,
          nextStopDepth: 0,
          po2: 1.1,
        },
        {
          timestamp: new Date(startedAt.getTime() + 30_000),
          depth: 12.5,
          temperature: 22,
          nextStopDepth: 3,
          po2: 1.35,
        },
      ],
      diveGasMesgs: [
        {
          messageIndex: 0,
          oxygenContent: 32,
          heliumContent: 0,
          mode: 'openCircuit',
          status: 'enabled',
        },
      ],
      diveSummaryMesgs: [
        { avgDepth: 7.4, maxDepth: 12.5, surfaceInterval: 3_600, diveNumber: 42 },
      ],
    } as FitMessages)

    expect(mapped.isDive).toBe(true)
    expect(mapped.profileSamples[1]).toEqual({
      elapsedSeconds: 30,
      depthMeters: 12.5,
      temperatureCelsius: 22,
      decoCeilingMeters: 3,
    })
    expect(mapped.gases[0]?.oxygenPercent).toBe(32)
    expect(mapped.maximumPpo2).toBe(1.35)
  })

  test('decodes a real FIT binary using the official Garmin SDK', () => {
    const startedAt = new Date('2026-09-01T10:00:00Z')
    const encoder = new Encoder()
    encoder.onMesg(messageNumber('FILE_ID'), {
      manufacturer: 'development',
      product: 1,
      timeCreated: startedAt,
      type: 'activity',
    } as FileIdMesg)
    encoder.onMesg(messageNumber('SESSION'), {
      timestamp: new Date(startedAt.getTime() + 60_000),
      startTime: startedAt,
      sport: 'diving',
      subSport: 'singleGasDiving',
      totalElapsedTime: 60,
      totalTimerTime: 60,
      event: 'session',
      eventType: 'stop',
    } as SessionMesg)
    encoder.onMesg(messageNumber('RECORD'), {
      timestamp: startedAt,
      depth: 0,
      temperature: 23,
    } as RecordMesg)
    encoder.onMesg(messageNumber('RECORD'), {
      timestamp: new Date(startedAt.getTime() + 30_000),
      depth: 8.2,
      temperature: 21,
      nextStopDepth: 0,
    } as RecordMesg)

    const decoded = decodeGarminFit(encoder.close())
    expect(decoded.isDive).toBe(true)
    expect(decoded.profileSamples.map((sample) => sample.depthMeters)).toEqual([0, 8.2])
  })
})
