import { describe, expect, test } from 'bun:test'
import {
  createProfileGeometry,
  findNearestProfilePoint,
  PROFILE_CHART_VIEWBOX,
} from './profile-chart'

describe('dive profile chart geometry', () => {
  test('plots time left-to-right and increasing depth downward', () => {
    const geometry = createProfileGeometry([
      { elapsedSeconds: 60, depthMeters: 10 },
      { elapsedSeconds: 0, depthMeters: 0 },
      { elapsedSeconds: 120, depthMeters: 20 },
    ])

    expect(geometry.points.map((point) => point.elapsedSeconds)).toEqual([0, 60, 120])
    expect(geometry.points[0]?.x).toBe(PROFILE_CHART_VIEWBOX.left)
    expect(geometry.points[2]?.x).toBeGreaterThan(geometry.points[1]?.x ?? 0)
    expect(geometry.points[2]?.y).toBeGreaterThan(geometry.points[1]?.y ?? 0)
    expect(geometry.chartDepthMeters).toBe(20)
    expect(geometry.areaPath).toEndWith('Z')
  })

  test('filters invalid values and locates the nearest plotted sample', () => {
    const geometry = createProfileGeometry([
      { elapsedSeconds: 0, depthMeters: 1 },
      { elapsedSeconds: 30, depthMeters: Number.NaN },
      { elapsedSeconds: 60, depthMeters: 8 },
    ])

    expect(geometry.points).toHaveLength(2)
    expect(
      findNearestProfilePoint(geometry.points, (geometry.points[1]?.x ?? 0) - 1),
    ).toBe(1)
    expect(findNearestProfilePoint([], 100)).toBe(-1)
  })
})
