import { describe, expect, test } from 'bun:test'
import {
  createProfileGeometry,
  findNearestProfilePoint,
  PROFILE_CHART_VIEWBOX,
} from './profile-chart'

function sample(
  elapsedSeconds: number,
  depthMeters: number,
  values: Partial<{
    temperatureCelsius: number | null
    pressureBar: number | null
    tank1PressureBar: number | null
    tank2PressureBar: number | null
    decoCeilingMeters: number | null
    tankNumber: number | null
  }> = {},
) {
  return {
    elapsedSeconds,
    depthMeters,
    temperatureCelsius: null,
    pressureBar: null,
    tank1PressureBar: null,
    tank2PressureBar: null,
    decoCeilingMeters: null,
    tankNumber: null,
    ...values,
  }
}

describe('dive profile chart geometry', () => {
  test('plots time left-to-right and increasing depth downward', () => {
    const geometry = createProfileGeometry([
      sample(60, 10),
      sample(0, 0),
      sample(120, 20),
    ])

    expect(geometry.points.map((point) => point.elapsedSeconds)).toEqual([0, 60, 120])
    expect(geometry.points[0]?.x).toBe(PROFILE_CHART_VIEWBOX.left)
    expect(geometry.points[2]?.x).toBeGreaterThan(geometry.points[1]?.x ?? 0)
    expect(geometry.points[2]?.depthY).toBeGreaterThan(geometry.points[1]?.depthY ?? 0)
    expect(geometry.chartDepthMeters).toBe(20)
    expect(geometry.depthAreaPath).toEndWith('Z')
  })

  test('filters invalid values and locates the nearest plotted sample', () => {
    const geometry = createProfileGeometry([
      sample(0, 1),
      sample(30, Number.NaN),
      sample(60, 8),
    ])

    expect(geometry.points).toHaveLength(2)
    expect(
      findNearestProfilePoint(geometry.points, (geometry.points[1]?.x ?? 0) - 1),
    ).toBe(1)
    expect(findNearestProfilePoint([], 100)).toBe(-1)
  })

  test('builds aligned auxiliary tracks, gaps, ceilings, and tank switches', () => {
    const geometry = createProfileGeometry([
      sample(0, 1, {
        temperatureCelsius: 20,
        pressureBar: 200,
        tank1PressureBar: 200,
        tank2PressureBar: 190,
        tankNumber: 1,
      }),
      sample(30, 20, {
        temperatureCelsius: 12,
        pressureBar: null,
        tank1PressureBar: 180,
        tank2PressureBar: null,
        decoCeilingMeters: 6,
        tankNumber: 2,
      }),
      sample(60, 8, {
        temperatureCelsius: 15,
        pressureBar: 150,
        tank1PressureBar: 160,
        tank2PressureBar: 150,
        decoCeilingMeters: 3,
        tankNumber: 2,
      }),
    ])

    expect(geometry.temperaturePath).toContain('L')
    expect(geometry.tank1PressurePath).toContain('L')
    expect(geometry.tank2PressurePath.match(/M/g)).toHaveLength(2)
    expect(geometry.pressurePath).toBe('')
    expect(geometry.ceilingPath).toContain('L')
    expect(geometry.tankSwitches.map((point) => point.tankNumber)).toEqual([1, 2])
    expect(geometry.pressureRange).toEqual({ minimum: 0, maximum: 200 })
  })
})
