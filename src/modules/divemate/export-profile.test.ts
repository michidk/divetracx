import { describe, expect, test } from 'bun:test'
import { encodeDiveMateProfile } from './export-profile'

describe('DiveMate profile export', () => {
  test('encodes canonical profile samples into DiveMate fixed-width fields', () => {
    expect(
      encodeDiveMateProfile([
        {
          elapsedSeconds: 0,
          depthMeters: '0',
          temperatureCelsius: '22',
          pressureBar: '200',
          tank1PressureBar: '199.5',
          tank2PressureBar: null,
          decoCeilingMeters: null,
          tankNumber: 1,
        },
        {
          elapsedSeconds: 30,
          depthMeters: '12.3',
          temperatureCelsius: '21.5',
          pressureBar: '150',
          tank1PressureBar: '195',
          tank2PressureBar: '145',
          decoCeilingMeters: '3',
          tankNumber: 2,
        },
      ]),
    ).toEqual({
      profileIntervalSeconds: 30,
      profile: '000000000000012300000000',
      profile2: '2202000000021515001000',
      profile3: '1995000000000019501450000000',
      profile4: '000000000000000003',
    })
  })

  test('resamples irregular canonical data at its greatest common interval', () => {
    const encoded = encodeDiveMateProfile([
      {
        elapsedSeconds: 0,
        depthMeters: '0',
        temperatureCelsius: null,
        pressureBar: null,
        tank1PressureBar: null,
        tank2PressureBar: null,
        decoCeilingMeters: null,
        tankNumber: null,
      },
      {
        elapsedSeconds: 4,
        depthMeters: '2',
        temperatureCelsius: null,
        pressureBar: null,
        tank1PressureBar: null,
        tank2PressureBar: null,
        decoCeilingMeters: null,
        tankNumber: null,
      },
      {
        elapsedSeconds: 10,
        depthMeters: '5',
        temperatureCelsius: null,
        pressureBar: null,
        tank1PressureBar: null,
        tank2PressureBar: null,
        decoCeilingMeters: null,
        tankNumber: null,
      },
    ])

    expect(encoded.profileIntervalSeconds).toBe(2)
    expect(encoded.profile).toHaveLength(6 * 12)
  })
})
