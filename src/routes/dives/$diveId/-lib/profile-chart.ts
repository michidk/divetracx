export interface DiveProfilePoint {
  elapsedSeconds: number
  depthMeters: number
  temperatureCelsius: number | null
  pressureBar: number | null
  tank1PressureBar: number | null
  tank2PressureBar: number | null
  decoCeilingMeters: number | null
  tankNumber: number | null
}

export interface PositionedDiveProfilePoint extends DiveProfilePoint {
  x: number
  depthY: number
  temperatureY: number | null
  pressureY: number | null
  tank1PressureY: number | null
  tank2PressureY: number | null
  ceilingY: number | null
}

export const PROFILE_CHART_VIEWBOX = {
  width: 960,
  height: 610,
  left: 64,
  right: 28,
  top: 34,
  bottom: 48,
  depthHeight: 268,
  temperatureTop: 352,
  temperatureHeight: 72,
  pressureTop: 476,
  pressureHeight: 82,
} as const

const X_TICK_COUNT = 4
const Y_TICK_COUNT = 4

function depthCeiling(maximumDepthMeters: number) {
  return Math.max(5, Math.ceil(maximumDepthMeters / 5) * 5)
}

function finiteOrNull(value: number | null) {
  return value !== null && Number.isFinite(value) ? value : null
}

function paddedRange(values: number[], minimumSpan: number) {
  if (values.length === 0) return null
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = Math.max(minimumSpan, maximum - minimum)
  const padding = span * 0.08
  return { minimum: minimum - padding, maximum: maximum + padding }
}

function scaleTrackValue(
  value: number | null,
  range: { minimum: number; maximum: number } | null,
  top: number,
  height: number,
) {
  if (value === null || !range) return null
  return top + ((range.maximum - value) / (range.maximum - range.minimum)) * height
}

export function createSegmentedPath<T>(
  points: T[],
  position: (point: T) => { x: number; y: number } | null,
) {
  let drawing = false
  return points
    .map((point) => {
      const positioned = position(point)
      if (!positioned) {
        drawing = false
        return ''
      }
      const command = drawing ? 'L' : 'M'
      drawing = true
      return `${command} ${positioned.x} ${positioned.y}`
    })
    .filter(Boolean)
    .join(' ')
}

function createSegmentedAreaPath<T>(
  points: T[],
  position: (point: T) => { x: number; y: number } | null,
  baselineY: number,
) {
  const paths: string[] = []
  let segment: Array<{ x: number; y: number }> = []

  function closeSegment() {
    const first = segment[0]
    const last = segment.at(-1)
    if (!first || !last) return
    paths.push(
      `M ${first.x} ${baselineY} L ${segment
        .map((point) => `${point.x} ${point.y}`)
        .join(' L ')} L ${last.x} ${baselineY} Z`,
    )
    segment = []
  }

  for (const point of points) {
    const positioned = position(point)
    if (positioned) {
      segment.push(positioned)
    } else {
      closeSegment()
    }
  }
  closeSegment()
  return paths.join(' ')
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
    .map((sample) => ({
      ...sample,
      temperatureCelsius: finiteOrNull(sample.temperatureCelsius),
      pressureBar: finiteOrNull(sample.pressureBar),
      tank1PressureBar: finiteOrNull(sample.tank1PressureBar),
      tank2PressureBar: finiteOrNull(sample.tank2PressureBar),
      decoCeilingMeters: finiteOrNull(sample.decoCeilingMeters),
    }))
    .slice()
    .sort((left, right) => left.elapsedSeconds - right.elapsedSeconds)
  const plotWidth =
    PROFILE_CHART_VIEWBOX.width - PROFILE_CHART_VIEWBOX.left - PROFILE_CHART_VIEWBOX.right
  const maximumElapsedSeconds = Math.max(
    1,
    ...points.map((point) => point.elapsedSeconds),
  )
  const maximumDepthMeters = Math.max(0, ...points.map((point) => point.depthMeters))
  const chartDepthMeters = depthCeiling(maximumDepthMeters)
  const temperatureRange = paddedRange(
    points.flatMap((point) =>
      point.temperatureCelsius === null ? [] : [point.temperatureCelsius],
    ),
    2,
  )
  const maximumPressureBar = Math.max(
    0,
    ...points.flatMap((point) =>
      [point.pressureBar, point.tank1PressureBar, point.tank2PressureBar].flatMap(
        (pressure) => (pressure === null ? [] : [pressure]),
      ),
    ),
  )
  const pressureRange =
    maximumPressureBar > 0
      ? { minimum: 0, maximum: Math.ceil(maximumPressureBar / 50) * 50 }
      : null

  const positionedPoints: PositionedDiveProfilePoint[] = points.map((point) => ({
    ...point,
    x:
      PROFILE_CHART_VIEWBOX.left +
      (point.elapsedSeconds / maximumElapsedSeconds) * plotWidth,
    depthY:
      PROFILE_CHART_VIEWBOX.top +
      (point.depthMeters / chartDepthMeters) * PROFILE_CHART_VIEWBOX.depthHeight,
    temperatureY: scaleTrackValue(
      point.temperatureCelsius,
      temperatureRange,
      PROFILE_CHART_VIEWBOX.temperatureTop,
      PROFILE_CHART_VIEWBOX.temperatureHeight,
    ),
    pressureY: scaleTrackValue(
      point.pressureBar,
      pressureRange,
      PROFILE_CHART_VIEWBOX.pressureTop,
      PROFILE_CHART_VIEWBOX.pressureHeight,
    ),
    tank1PressureY: scaleTrackValue(
      point.tank1PressureBar,
      pressureRange,
      PROFILE_CHART_VIEWBOX.pressureTop,
      PROFILE_CHART_VIEWBOX.pressureHeight,
    ),
    tank2PressureY: scaleTrackValue(
      point.tank2PressureBar,
      pressureRange,
      PROFILE_CHART_VIEWBOX.pressureTop,
      PROFILE_CHART_VIEWBOX.pressureHeight,
    ),
    ceilingY:
      point.decoCeilingMeters === null || point.decoCeilingMeters <= 0
        ? null
        : PROFILE_CHART_VIEWBOX.top +
          (point.decoCeilingMeters / chartDepthMeters) *
            PROFILE_CHART_VIEWBOX.depthHeight,
  }))
  const depthPath = createSegmentedPath(positionedPoints, (point) => ({
    x: point.x,
    y: point.depthY,
  }))
  const temperaturePath = createSegmentedPath(positionedPoints, (point) =>
    point.temperatureY === null ? null : { x: point.x, y: point.temperatureY },
  )
  const pressurePath = createSegmentedPath(positionedPoints, (point) =>
    point.pressureY === null ||
    (point.tankNumber === 1 && point.tank1PressureY !== null) ||
    (point.tankNumber === 2 && point.tank2PressureY !== null)
      ? null
      : { x: point.x, y: point.pressureY },
  )
  const tank1PressurePath = createSegmentedPath(positionedPoints, (point) =>
    point.tank1PressureY === null ? null : { x: point.x, y: point.tank1PressureY },
  )
  const tank2PressurePath = createSegmentedPath(positionedPoints, (point) =>
    point.tank2PressureY === null ? null : { x: point.x, y: point.tank2PressureY },
  )
  const ceilingPath = createSegmentedPath(positionedPoints, (point) =>
    point.ceilingY === null ? null : { x: point.x, y: point.ceilingY },
  )
  const ceilingAreaPath = createSegmentedAreaPath(
    positionedPoints,
    (point) => (point.ceilingY === null ? null : { x: point.x, y: point.ceilingY }),
    PROFILE_CHART_VIEWBOX.top,
  )
  const firstPoint = positionedPoints[0]
  const lastPoint = positionedPoints.at(-1)
  const depthAreaPath =
    firstPoint && lastPoint
      ? `M ${firstPoint.x} ${PROFILE_CHART_VIEWBOX.top} ${depthPath.replace(/^M/, 'L')} L ${lastPoint.x} ${PROFILE_CHART_VIEWBOX.top} Z`
      : ''
  const tankSwitches = positionedPoints.filter((point, index) => {
    if (point.tankNumber === null) return false
    const previousTankNumber = positionedPoints[index - 1]?.tankNumber ?? null
    return point.tankNumber !== previousTankNumber
  })

  return {
    points: positionedPoints,
    depthPath,
    depthAreaPath,
    temperaturePath,
    pressurePath,
    tank1PressurePath,
    tank2PressurePath,
    ceilingPath,
    ceilingAreaPath,
    tankSwitches,
    maximumElapsedSeconds,
    maximumDepthMeters,
    chartDepthMeters,
    temperatureRange,
    pressureRange,
    plotWidth,
    xTicks: Array.from({ length: X_TICK_COUNT + 1 }, (_, index) => {
      const ratio = index / X_TICK_COUNT
      return {
        x: PROFILE_CHART_VIEWBOX.left + ratio * plotWidth,
        elapsedSeconds: ratio * maximumElapsedSeconds,
      }
    }),
    depthTicks: Array.from({ length: Y_TICK_COUNT + 1 }, (_, index) => {
      const ratio = index / Y_TICK_COUNT
      return {
        y: PROFILE_CHART_VIEWBOX.top + ratio * PROFILE_CHART_VIEWBOX.depthHeight,
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
