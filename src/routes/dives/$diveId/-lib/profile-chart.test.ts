import { describe, expect, test } from 'bun:test'
import {
  createProfileGeometry,
  createProfileMagnifierViewBox,
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
    segmentIndex: number
  }> = {},
) {
  return {
    segmentIndex: 0,
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
    expect(geometry.depthPath).toStartWith(
      `M ${PROFILE_CHART_VIEWBOX.left} ${PROFILE_CHART_VIEWBOX.top}`,
    )
    expect(geometry.depthPath).toEndWith(
      `${geometry.points[2]?.x} ${PROFILE_CHART_VIEWBOX.top}`,
    )
    expect(geometry.deepestPoint?.elapsedSeconds).toBe(120)
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

  test('creates an undistorted magnifier window around depth and ceiling', () => {
    const geometry = createProfileGeometry([
      sample(0, 0),
      sample(60, 24, { decoCeilingMeters: 6 }),
      sample(120, 0),
    ])
    const selected = geometry.points[1]
    expect(selected).toBeDefined()
    if (!selected) return

    const viewBox = createProfileMagnifierViewBox(selected, geometry.plotWidth)

    expect(viewBox.width / viewBox.height).toBeCloseTo(360 / 220)
    expect(viewBox.x).toBeLessThanOrEqual(selected.x)
    expect(viewBox.x + viewBox.width).toBeGreaterThanOrEqual(selected.x)
    expect(viewBox.y).toBeLessThanOrEqual(selected.depthY)
    expect(viewBox.y + viewBox.height).toBeGreaterThanOrEqual(selected.depthY)
    expect(viewBox.y).toBeLessThanOrEqual(selected.ceilingY ?? selected.depthY)
  })

  test('locates depth crossings along active ceiling steps', () => {
    const geometry = createProfileGeometry([
      sample(0, 10, { decoCeilingMeters: 5 }),
      sample(30, 3, { decoCeilingMeters: 5 }),
      sample(60, 10, { decoCeilingMeters: 5 }),
    ])

    expect(geometry.ceilingCrossings).toHaveLength(2)
    expect(geometry.ceilingCrossings.map((crossing) => crossing.direction)).toEqual([
      'exceeded',
      'cleared',
    ])
    expect(geometry.ceilingCrossings[0]?.elapsedSeconds).toBeCloseTo(21.43, 1)
    expect(geometry.ceilingCrossings[1]?.elapsedSeconds).toBeCloseTo(38.57, 1)
    expect(geometry.ceilingCrossings[0]?.y).toBe(
      geometry.points[0]?.ceilingY ?? Number.NaN,
    )
    expect(geometry.ceilingViolationPath.match(/M/g)).toHaveLength(2)
    expect(geometry.ceilingViolationPath).toContain(
      `${geometry.ceilingCrossings[0]?.x} ${geometry.ceilingCrossings[0]?.y}`,
    )
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
    expect(geometry.ceilingPath).toStartWith(
      `M ${geometry.points[1]?.x} ${PROFILE_CHART_VIEWBOX.top}`,
    )
    expect(geometry.ceilingPath).toEndWith(
      `${geometry.points[2]?.x} ${PROFILE_CHART_VIEWBOX.top}`,
    )
    expect(geometry.ceilingAreaPath).toStartWith(
      `M ${geometry.points[1]?.x} ${PROFILE_CHART_VIEWBOX.top}`,
    )
    expect(geometry.ceilingAreaPath).toEndWith('Z')
    expect(geometry.tankSwitches.map((point) => point.tankNumber)).toEqual([1, 2])
    expect(geometry.minimumTemperaturePoint?.elapsedSeconds).toBe(30)
    expect(geometry.minimumTemperaturePoint?.temperatureCelsius).toBe(12)
    expect(geometry.pressureRange).toEqual({ minimum: 0, maximum: 200 })
  })

  test('lifts the pen across a merged dive’s surface interval', () => {
    const geometry = createProfileGeometry([
      sample(0, 0),
      sample(60, 18),
      sample(120, 0),
      // The diver surfaced for half an hour before the computer logged again.
      sample(1920, 0, { segmentIndex: 1 }),
      sample(1980, 12, { segmentIndex: 1 }),
      sample(2040, 0, { segmentIndex: 1 }),
    ])

    // One outline and one fill per recorded dive, never a line through the gap.
    expect(geometry.depthPath.match(/M/g)).toHaveLength(2)
    expect(geometry.depthAreaPath.match(/Z/g)).toHaveLength(2)
    expect(geometry.surfaceGaps).toHaveLength(1)
    expect(geometry.surfaceGaps[0]?.startElapsedSeconds).toBe(120)
    expect(geometry.surfaceGaps[0]?.endElapsedSeconds).toBe(1920)
    expect(geometry.surfaceGaps[0]?.startX).toBe(geometry.points[2]?.x ?? 0)
    expect(geometry.surfaceGaps[0]?.endX).toBe(geometry.points[3]?.x ?? 0)
    // The merged timeline keeps real elapsed times, so the gap is to scale.
    expect(geometry.maximumElapsedSeconds).toBe(2040)
  })

  test('never interpolates a ceiling across a surface interval', () => {
    const geometry = createProfileGeometry([
      sample(0, 30, { decoCeilingMeters: 6 }),
      sample(60, 30, { decoCeilingMeters: 6 }),
      // A new segment that starts shallower must not read as clearing the
      // previous segment's ceiling.
      sample(3600, 2, { decoCeilingMeters: 0, segmentIndex: 1 }),
      sample(3660, 2, { decoCeilingMeters: 0, segmentIndex: 1 }),
    ])

    expect(geometry.ceilingCrossings).toHaveLength(0)
    expect(geometry.ceilingPath.match(/M/g)).toHaveLength(1)
  })

  test('breaks every track at a segment boundary', () => {
    const geometry = createProfileGeometry([
      sample(0, 10, { temperatureCelsius: 20, tank1PressureBar: 200 }),
      sample(60, 12, { temperatureCelsius: 19, tank1PressureBar: 180 }),
      sample(1800, 12, {
        temperatureCelsius: 19,
        tank1PressureBar: 170,
        segmentIndex: 1,
      }),
      sample(1860, 10, {
        temperatureCelsius: 20,
        tank1PressureBar: 150,
        segmentIndex: 1,
      }),
    ])

    expect(geometry.temperaturePath.match(/M/g)).toHaveLength(2)
    expect(geometry.tank1PressurePath.match(/M/g)).toHaveLength(2)
  })
})
