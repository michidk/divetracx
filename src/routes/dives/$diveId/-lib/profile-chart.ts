export interface DiveProfilePoint {
  /**
   * Which recorded dive this sample came from. Merging appends another dive's
   * profile under the next index; the surface interval between segments holds
   * no data, so the chart lifts the pen rather than drawing through it.
   */
  segmentIndex: number
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

export interface DiveProfileSurfaceGap {
  startX: number
  endX: number
  startElapsedSeconds: number
  endElapsedSeconds: number
}

export interface DiveProfileCeilingCrossing {
  x: number
  y: number
  elapsedSeconds: number
  direction: 'exceeded' | 'cleared'
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

const PROFILE_MAGNIFIER_ASPECT_RATIO = 360 / 220
const PROFILE_MAGNIFIER_MINIMUM_HEIGHT = 96
const PROFILE_MAGNIFIER_FOCUS_PADDING = 18

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
  breaksBefore: (point: T, previous: T) => boolean = () => false,
) {
  let drawing = false
  return points
    .map((point, index) => {
      const previous = points[index - 1]
      if (previous !== undefined && breaksBefore(point, previous)) drawing = false
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

/** True when two adjacent samples sit either side of a surface interval. */
function startsSegment(
  point: { segmentIndex: number },
  previous: { segmentIndex: number },
) {
  return point.segmentIndex !== previous.segmentIndex
}

/** Runs of consecutive samples belonging to one recorded dive. */
function groupSegments<T extends { segmentIndex: number }>(points: T[]) {
  const runs: T[][] = []
  for (const point of points) {
    const current = runs.at(-1)
    const previous = current?.at(-1)
    if (!current || (previous && startsSegment(point, previous))) {
      runs.push([point])
      continue
    }
    current.push(point)
  }
  return runs
}

function createCeilingPaths(points: PositionedDiveProfilePoint[]) {
  const lineSegments: string[] = []
  const areaSegments: string[] = []
  let index = 0

  while (index < points.length) {
    while (index < points.length && points[index]?.ceilingY === null) index += 1
    const first = points[index]
    if (!first || first.ceilingY === null) break

    const commands = [
      `M ${first.x} ${PROFILE_CHART_VIEWBOX.top}`,
      `L ${first.x} ${first.ceilingY}`,
    ]
    let previous = first
    index += 1

    while (index < points.length) {
      const point = points[index]
      if (!point || point.ceilingY === null || startsSegment(point, previous)) break
      commands.push(`L ${point.x} ${previous.ceilingY}`, `L ${point.x} ${point.ceilingY}`)
      previous = point
      index += 1
    }

    const closureX = points[index]?.x ?? previous.x
    commands.push(
      `L ${closureX} ${previous.ceilingY}`,
      `L ${closureX} ${PROFILE_CHART_VIEWBOX.top}`,
    )
    lineSegments.push(commands.join(' '))
    areaSegments.push(`${commands.join(' ')} Z`)
  }

  return { line: lineSegments.join(' '), area: areaSegments.join(' ') }
}

function findCeilingCrossings(points: PositionedDiveProfilePoint[]) {
  const crossings: DiveProfileCeilingCrossing[] = []

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (!previous || !current || previous.ceilingY === null) continue
    if (startsSegment(current, previous)) continue

    const previousDistance = previous.depthY - previous.ceilingY
    const currentDistance = current.depthY - previous.ceilingY
    const crossedAbove = previousDistance >= 0 && currentDistance < 0
    const crossedBelow = previousDistance < 0 && currentDistance >= 0
    if (!crossedAbove && !crossedBelow) continue

    const ratio = previousDistance / (previousDistance - currentDistance)
    crossings.push({
      x: previous.x + (current.x - previous.x) * ratio,
      y: previous.ceilingY,
      elapsedSeconds:
        previous.elapsedSeconds +
        (current.elapsedSeconds - previous.elapsedSeconds) * ratio,
      direction: crossedAbove ? 'exceeded' : 'cleared',
    })
  }

  return crossings
}

function createCeilingViolationPath(points: PositionedDiveProfilePoint[]) {
  const segments: string[] = []

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (!previous || !current || previous.ceilingY === null) continue
    if (startsSegment(current, previous)) continue

    const previousDistance = previous.depthY - previous.ceilingY
    const currentDistance = current.depthY - previous.ceilingY
    const previousViolated = previousDistance < 0
    const currentViolated = currentDistance < 0
    if (!previousViolated && !currentViolated) continue

    let startX = previous.x
    let startY = previous.depthY
    let endX = current.x
    let endY = current.depthY

    if (previousViolated !== currentViolated) {
      const ratio = previousDistance / (previousDistance - currentDistance)
      const crossingX = previous.x + (current.x - previous.x) * ratio
      if (previousViolated) {
        endX = crossingX
        endY = previous.ceilingY
      } else {
        startX = crossingX
        startY = previous.ceilingY
      }
    }

    segments.push(`M ${startX} ${startY} L ${endX} ${endY}`)
  }

  return segments.join(' ')
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
    .sort(
      (left, right) =>
        left.elapsedSeconds - right.elapsedSeconds ||
        left.segmentIndex - right.segmentIndex,
    )
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
  const temperaturePath = createSegmentedPath(
    positionedPoints,
    (point) =>
      point.temperatureY === null ? null : { x: point.x, y: point.temperatureY },
    startsSegment,
  )
  const pressurePath = createSegmentedPath(
    positionedPoints,
    (point) =>
      point.pressureY === null ||
      (point.tankNumber === 1 && point.tank1PressureY !== null) ||
      (point.tankNumber === 2 && point.tank2PressureY !== null)
        ? null
        : { x: point.x, y: point.pressureY },
    startsSegment,
  )
  const tank1PressurePath = createSegmentedPath(
    positionedPoints,
    (point) =>
      point.tank1PressureY === null ? null : { x: point.x, y: point.tank1PressureY },
    startsSegment,
  )
  const tank2PressurePath = createSegmentedPath(
    positionedPoints,
    (point) =>
      point.tank2PressureY === null ? null : { x: point.x, y: point.tank2PressureY },
    startsSegment,
  )
  const segmentRuns = groupSegments(positionedPoints)
  // Each recorded dive gets its own closed outline and fill, so the surface
  // interval between them stays empty instead of being shaded as a dive.
  const closedDepthPath = segmentRuns
    .map((run) => {
      const start = run[0]
      const end = run.at(-1)
      if (!start || !end) return ''
      const body = run.map((point) => `L ${point.x} ${point.depthY}`).join(' ')
      return `M ${start.x} ${PROFILE_CHART_VIEWBOX.top} ${body} L ${end.x} ${PROFILE_CHART_VIEWBOX.top}`
    })
    .filter(Boolean)
    .join(' ')
  const depthAreaPath = segmentRuns
    .map((run) => {
      const start = run[0]
      const end = run.at(-1)
      if (!start || !end) return ''
      const body = run.map((point) => `L ${point.x} ${point.depthY}`).join(' ')
      return `M ${start.x} ${PROFILE_CHART_VIEWBOX.top} ${body} L ${end.x} ${PROFILE_CHART_VIEWBOX.top} Z`
    })
    .filter(Boolean)
    .join(' ')
  const surfaceGaps: DiveProfileSurfaceGap[] = segmentRuns.flatMap((run, index) => {
    const previous = segmentRuns[index - 1]?.at(-1)
    const start = run[0]
    if (!previous || !start) return []
    return [
      {
        startX: previous.x,
        endX: start.x,
        startElapsedSeconds: previous.elapsedSeconds,
        endElapsedSeconds: start.elapsedSeconds,
      },
    ]
  })
  const ceilingPaths = createCeilingPaths(positionedPoints)
  const ceilingPath = ceilingPaths.line
  const ceilingAreaPath = ceilingPaths.area
  const ceilingCrossings = findCeilingCrossings(positionedPoints)
  const ceilingViolationPath = createCeilingViolationPath(positionedPoints)
  const deepestPoint = positionedPoints.reduce<PositionedDiveProfilePoint | null>(
    (deepest, point) =>
      deepest === null || point.depthMeters > deepest.depthMeters ? point : deepest,
    null,
  )
  const minimumTemperaturePoint =
    positionedPoints.reduce<PositionedDiveProfilePoint | null>(
      (minimum, point) =>
        point.temperatureCelsius !== null &&
        (minimum === null ||
          minimum.temperatureCelsius === null ||
          point.temperatureCelsius < minimum.temperatureCelsius)
          ? point
          : minimum,
      null,
    )
  const tankSwitches = positionedPoints.filter((point, index) => {
    if (point.tankNumber === null) return false
    const previousTankNumber = positionedPoints[index - 1]?.tankNumber ?? null
    return point.tankNumber !== previousTankNumber
  })

  return {
    points: positionedPoints,
    depthPath: closedDepthPath,
    depthAreaPath,
    temperaturePath,
    pressurePath,
    tank1PressurePath,
    tank2PressurePath,
    ceilingPath,
    ceilingAreaPath,
    ceilingCrossings,
    ceilingViolationPath,
    tankSwitches,
    surfaceGaps,
    maximumElapsedSeconds,
    maximumDepthMeters,
    deepestPoint,
    minimumTemperaturePoint,
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

export function createProfileMagnifierViewBox(
  point: PositionedDiveProfilePoint,
  plotWidth: number,
) {
  const plotLeft = PROFILE_CHART_VIEWBOX.left
  const plotRight = plotLeft + plotWidth
  const plotTop = PROFILE_CHART_VIEWBOX.top - 8
  const plotBottom = PROFILE_CHART_VIEWBOX.top + PROFILE_CHART_VIEWBOX.depthHeight + 8
  const focusTop = Math.min(point.depthY, point.ceilingY ?? point.depthY)
  const focusBottom = Math.max(point.depthY, point.ceilingY ?? point.depthY)
  const height = Math.min(
    plotBottom - plotTop,
    Math.max(
      PROFILE_MAGNIFIER_MINIMUM_HEIGHT,
      focusBottom - focusTop + PROFILE_MAGNIFIER_FOCUS_PADDING,
    ),
  )
  const width = height * PROFILE_MAGNIFIER_ASPECT_RATIO
  const focusCenterY = (focusTop + focusBottom) / 2

  return {
    x: Math.max(plotLeft, Math.min(point.x - width / 2, plotRight - width)),
    y: Math.max(plotTop, Math.min(focusCenterY - height / 2, plotBottom - height)),
    width,
    height,
  }
}
