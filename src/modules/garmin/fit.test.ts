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
      heartRateBpm: null,
      ndlSeconds: null,
      timeToSurfaceSeconds: null,
      cnsPercent: null,
      nitrogenLoadPercent: null,
    })
    expect(mapped.gases[0]?.oxygenPercent).toBe(32)
    expect(mapped.maximumPpo2).toBe(1.35)
  })

  test('reads wrist heart rate and drops the FIT no-reading sentinels', () => {
    const startedAt = new Date('2026-09-01T10:00:00Z')
    const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1_000)
    const mapped = mapDecodedGarminFit({
      sessionMesgs: [{ sport: 'diving', startTime: startedAt, totalTimerTime: 40 }],
      recordMesgs: [
        { timestamp: at(0), depth: 0, heartRate: 0 },
        { timestamp: at(10), depth: 5, heartRate: 92 },
        { timestamp: at(20), depth: 8, heartRate: 255 },
        { timestamp: at(30), depth: 9, heartRate: 88 },
        { timestamp: at(40), depth: 9 },
      ],
    } as FitMessages)

    expect(mapped.profileSamples.map((sample) => sample.heartRateBpm)).toEqual([
      null,
      92,
      null,
      88,
      null,
    ])
  })

  test('reads alerts, gas switches, the recording device, and deco settings', () => {
    const startedAt = new Date('2026-09-01T10:00:00Z')
    const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1_000)
    const mapped = mapDecodedGarminFit({
      sessionMesgs: [{ sport: 'diving', startTime: startedAt, totalTimerTime: 600 }],
      recordMesgs: [
        {
          timestamp: at(0),
          depth: 0,
          ndlTime: 59_654,
          cnsLoad: 0,
          n2Load: 1,
          timeToSurface: 0,
        },
        {
          timestamp: at(300),
          depth: 30,
          ndlTime: 120,
          cnsLoad: 4,
          n2Load: 90,
          timeToSurface: 60,
        },
        { timestamp: at(600), depth: 6, cnsLoad: 11, n2Load: 60, timeToSurface: 30 },
      ],
      eventMesgs: [
        { timestamp: at(0), event: 'diveGasSwitched', eventType: 'marker', data: 0 },
        { timestamp: at(0), event: 'timer', eventType: 'start' },
        {
          timestamp: at(150),
          event: 'diveAlert',
          eventType: 'marker',
          diveAlert: 'ascentCritical',
        },
        {
          timestamp: at(153),
          event: 'diveAlert',
          eventType: 'marker',
          diveAlert: 'alertDismissedByTimeout',
        },
        { timestamp: at(400), event: 'diveGasSwitched', eventType: 'marker', data: 1 },
        {
          timestamp: at(500),
          event: 'diveAlert',
          eventType: 'marker',
          diveAlert: 'ndlReached',
        },
      ],
      deviceInfoMesgs: [
        {
          deviceIndex: 'creator',
          garminProduct: 'descentMk3',
          serialNumber: 3504275763,
          softwareVersion: 27.16,
        },
        { deviceIndex: 1, garminProduct: 'descentMk3', localDeviceType: 'barometer' },
      ],
      diveSettingsMesgs: [{ model: 'zhl16c', gfLow: 40, gfHigh: 70, waterType: 'fresh' }],
      diveSummaryMesgs: [{ startCns: 0, endCns: 11, o2Toxicity: 31 }],
    } as unknown as FitMessages)

    expect(mapped.events).toEqual([
      {
        elapsedSeconds: 150,
        kind: 'alert',
        code: 'ascentCritical',
        label: 'Ascent rate critical',
        tankNumber: null,
      },
      {
        elapsedSeconds: 400,
        kind: 'gas_switch',
        code: 'diveGasSwitched',
        label: 'Switched to gas 2',
        tankNumber: 2,
      },
      {
        elapsedSeconds: 500,
        kind: 'alert',
        code: 'ndlReached',
        label: 'No-deco limit reached',
        tankNumber: null,
      },
    ])
    expect(mapped.device).toEqual({
      product: 'Descent Mk3',
      serialNumber: '3504275763',
      softwareVersion: '27.16',
    })
    expect(mapped.deco).toEqual({
      model: 'ZHL-16C',
      gradientFactorLow: 40,
      gradientFactorHigh: 70,
      waterType: 'fresh',
    })
    // A huge NDL means "no limit in range"; a missing one means in deco.
    expect(mapped.profileSamples.map((sample) => sample.ndlSeconds)).toEqual([
      null,
      120,
      null,
    ])
    expect(mapped.profileSamples[1]).toMatchObject({
      cnsPercent: 4,
      nitrogenLoadPercent: 90,
      timeToSurfaceSeconds: 60,
    })
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
