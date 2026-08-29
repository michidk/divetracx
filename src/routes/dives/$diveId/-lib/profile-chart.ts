export interface DiveProfilePoint {
  elapsedSeconds: number
  depthMeters: number
}

export interface PositionedDiveProfilePoint extends DiveProfilePoint {
  x: number
  y: number
}

export const PROFILE_CHART_VIEWBOX = {
  width: 960,
  height: 360,
  left: 64,
  right: 24,
  top: 30,
  bottom: 52,
} as const

const X_TICK_COUNT = 4
const Y_TICK_COUNT = 4

function depthCeiling(maximumDepthMeters: number) {
  return Math.max(5, Math.ceil(maximumDepthMeters / 5) * 5)
}

export function createProfileGeometry(samples: DiveProfilePoint[]) {
  const points = samples
    .filter(
      (sample) =>
        Number.isFinite(sample.elapsedSeconds) &&
        sample.elapsedSeconds >= 0 &&
        Number.isFinite(sample.depthMeters) &&
        sample.depthMeters >= 0,
    )
    .slice()
    .sort((left, right) => left.elapsedSeconds - right.elapsedSeconds)
  const plotWidth =
    PROFILE_CHART_VIEWBOX.width - PROFILE_CHART_VIEWBOX.left - PROFILE_CHART_VIEWBOX.right
  const plotHeight =
    PROFILE_CHART_VIEWBOX.height -
    PROFILE_CHART_VIEWBOX.top -
    PROFILE_CHART_VIEWBOX.bottom
  const maximumElapsedSeconds = Math.max(
    1,
    ...points.map((point) => point.elapsedSeconds),
  )
  const maximumDepthMeters = Math.max(0, ...points.map((point) => point.depthMeters))
  const chartDepthMeters = depthCeiling(maximumDepthMeters)

  const positionedPoints: PositionedDiveProfilePoint[] = points.map((point) => ({
    ...point,
    x:
      PROFILE_CHART_VIEWBOX.left +
      (point.elapsedSeconds / maximumElapsedSeconds) * plotWidth,
    y: PROFILE_CHART_VIEWBOX.top + (point.depthMeters / chartDepthMeters) * plotHeight,
  }))
  const linePath = positionedPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const firstPoint = positionedPoints[0]
  const lastPoint = positionedPoints.at(-1)
  const areaPath =
    firstPoint && lastPoint
      ? `M ${firstPoint.x} ${PROFILE_CHART_VIEWBOX.top} ${linePath.replace(/^M/, 'L')} L ${lastPoint.x} ${PROFILE_CHART_VIEWBOX.top} Z`
      : ''

  return {
    points: positionedPoints,
    linePath,
    areaPath,
    maximumElapsedSeconds,
    maximumDepthMeters,
    chartDepthMeters,
    plotWidth,
    plotHeight,
    xTicks: Array.from({ length: X_TICK_COUNT + 1 }, (_, index) => {
      const ratio = index / X_TICK_COUNT
      return {
        x: PROFILE_CHART_VIEWBOX.left + ratio * plotWidth,
        elapsedSeconds: ratio * maximumElapsedSeconds,
      }
    }),
    yTicks: Array.from({ length: Y_TICK_COUNT + 1 }, (_, index) => {
      const ratio = index / Y_TICK_COUNT
      return {
        y: PROFILE_CHART_VIEWBOX.top + ratio * plotHeight,
        depthMeters: ratio * chartDepthMeters,
      }
    }),
  }
}

export function findNearestProfilePoint(
  points: PositionedDiveProfilePoint[],
  chartX: number,
) {
  const firstPoint = points[0]
  if (!firstPoint) return -1
  let nearestIndex = 0
  let nearestDistance = Math.abs(firstPoint.x - chartX)
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    if (!point) continue
    const distance = Math.abs(point.x - chartX)
    if (distance >= nearestDistance) continue
    nearestIndex = index
    nearestDistance = distance
  }
  return nearestIndex
}
