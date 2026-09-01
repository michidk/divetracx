import { useId, useMemo, useState } from 'react'
import type { PositionedDiveProfilePoint } from '../-lib/profile-chart'
import {
  createProfileGeometry,
  createProfileMagnifierViewBox,
  findNearestProfilePoint,
  PROFILE_CHART_VIEWBOX,
} from '../-lib/profile-chart'

interface ProfileSample {
  id: string
  elapsedSeconds: number
  depthMeters: string
  temperatureCelsius: string | null
  pressureBar: string | null
  tank1PressureBar: string | null
  tank2PressureBar: string | null
  decoCeilingMeters: string | null
  tankNumber: number | null
}

interface ProfileTank {
  id: string
  name: string | null
  computerTankNumber: number | null
  oxygenPercent: string | null
  heliumPercent: string | null
}

const TANK_COLORS = ['#0891b2', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#4f46e5']

function formatElapsedTime(totalSeconds: number) {
  const roundedSeconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(roundedSeconds / 60)
  const seconds = roundedSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function tankColor(tankNumber: number) {
  return TANK_COLORS[(tankNumber - 1) % TANK_COLORS.length] ?? TANK_COLORS[0]
}

function gasName(tank: ProfileTank) {
  const oxygen = Number(tank.oxygenPercent ?? 21)
  const helium = Number(tank.heliumPercent ?? 0)
  if (helium > 0) return `${oxygen.toFixed(0)}/${helium.toFixed(0)}`
  if (oxygen > 21) return `EAN${oxygen.toFixed(0)}`
  return 'Air'
}

function tankGasLines(tankNumber: number, tanks: ProfileTank[]) {
  const tank = tanks.find((item) => item.computerTankNumber === tankNumber)
  if (!tank) return []
  const gas = gasName(tank)
  const enrichedAir = /^EAN(\d+)$/.exec(gas)
  return enrichedAir ? ['EAN', enrichedAir[1] ?? ''] : [gas.toUpperCase()]
}

function tankSwitchColors(tankNumber: number, tanks: ProfileTank[]) {
  const tank = tanks.find((item) => item.computerTankNumber === tankNumber)
  const oxygen = Number(tank?.oxygenPercent ?? 21)
  const helium = Number(tank?.heliumPercent ?? 0)

  if (helium > 0) {
    return { fill: '#4c1d95', accent: '#ddd6fe', connector: '#ddd6fe' }
  }
  if (oxygen > 21) {
    return { fill: '#166534', accent: '#f5ee00', connector: '#f5ee00' }
  }
  return { fill: '#0ea5e9', accent: '#ffffff', connector: '#0ea5e9' }
}

function tankLabel(tankNumber: number, tanks: ProfileTank[]) {
  const tank = tanks.find((item) => item.computerTankNumber === tankNumber)
  if (!tank) return `Tank ${tankNumber}`
  return `${tank.name || `Tank ${tankNumber}`} · ${gasName(tank)}`
}

function tankName(tankNumber: number, tanks: ProfileTank[]) {
  const tank = tanks.find((item) => item.computerTankNumber === tankNumber)
  return tank?.name || `Tank ${tankNumber}`
}

function TankSwitchMarker({
  point,
  tanks,
}: {
  point: PositionedDiveProfilePoint
  tanks: ProfileTank[]
}) {
  if (point.tankNumber === null) return null

  const tankNumber = point.tankNumber
  const gasLines = tankGasLines(tankNumber, tanks)
  const colors = tankSwitchColors(tankNumber, tanks)
  const textLines = [`T${tankNumber}`, ...gasLines]
  const lineHeight = textLines.length === 3 ? 7.5 : 9
  const markerRadius = 14
  const markerY = point.depthY + 56
  const firstLineY = markerY - ((textLines.length - 1) * lineHeight) / 2 + 3

  return (
    <g
      aria-label={`Tank switch to ${tankLabel(tankNumber, tanks)} at ${formatElapsedTime(point.elapsedSeconds)}`}
    >
      <line
        x1={point.x}
        x2={point.x}
        y1={point.depthY}
        y2={markerY - markerRadius}
        stroke={colors.connector}
        strokeWidth="1.5"
        strokeDasharray="2 3"
        opacity="0.85"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={point.x}
        cy={markerY}
        r={markerRadius}
        fill={colors.fill}
        stroke={colors.accent}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
      {textLines.map((line, index) => (
        <text
          key={line}
          x={point.x}
          y={firstLineY + index * lineHeight}
          textAnchor="middle"
          className="pointer-events-none text-[8px] font-bold"
          fill={colors.accent}
          stroke={colors.fill}
          strokeWidth="1"
          paintOrder="stroke"
        >
          {line}
        </text>
      ))}
    </g>
  )
}

function ChartValueMarker({
  x,
  pointY,
  label,
  ariaLabel,
  color,
}: {
  x: number
  pointY: number
  label: string
  ariaLabel: string
  color: string
}) {
  const markerY = pointY - 30
  const markerHeight = 18
  const markerWidth = Math.max(42, label.length * 5.8 + 12)

  return (
    <g aria-label={ariaLabel}>
      <line
        x1={x}
        x2={x}
        y1={pointY}
        y2={markerY + markerHeight / 2}
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="2 3"
        opacity="0.85"
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={x - markerWidth / 2}
        y={markerY - markerHeight / 2}
        width={markerWidth}
        height={markerHeight}
        rx={markerHeight / 2}
        fill={color}
        className="stroke-background"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={x}
        y={markerY + 3.5}
        textAnchor="middle"
        className="pointer-events-none fill-white text-[9px] font-bold"
      >
        {label}
      </text>
    </g>
  )
}

function TrackBounds({
  top,
  height,
  label,
  maximum,
  minimum,
}: {
  top: number
  height: number
  label: string
  maximum: string
  minimum: string
}) {
  return (
    <g>
      <line
        x1={PROFILE_CHART_VIEWBOX.left}
        x2={PROFILE_CHART_VIEWBOX.width - PROFILE_CHART_VIEWBOX.right}
        y1={top}
        y2={top}
        className="stroke-border"
      />
      <line
        x1={PROFILE_CHART_VIEWBOX.left}
        x2={PROFILE_CHART_VIEWBOX.width - PROFILE_CHART_VIEWBOX.right}
        y1={top + height}
        y2={top + height}
        className="stroke-border"
      />
      <text
        x={PROFILE_CHART_VIEWBOX.left}
        y={top - 10}
        className="fill-foreground text-[12px] font-semibold"
      >
        {label}
      </text>
      <text
        x={PROFILE_CHART_VIEWBOX.left - 10}
        y={top + 4}
        textAnchor="end"
        className="fill-muted-foreground text-[11px]"
      >
        {maximum}
      </text>
      <text
        x={PROFILE_CHART_VIEWBOX.left - 10}
        y={top + height + 4}
        textAnchor="end"
        className="fill-muted-foreground text-[11px]"
      >
        {minimum}
      </text>
    </g>
  )
}

function CursorDot({
  x,
  y,
  radius = 4.5,
  className,
  fill,
}: {
  x: number
  y: number
  radius?: number
  className?: string
  fill?: string
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r={radius}
      className={`${className ?? ''} stroke-background`}
      fill={fill}
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
    />
  )
}

function CursorValue({
  x,
  y,
  children,
  fontSize = 11,
}: {
  x: number
  y: number
  children: string
  fontSize?: number
}) {
  const showBelow = x > PROFILE_CHART_VIEWBOX.width - PROFILE_CHART_VIEWBOX.right - 72
  return (
    <text
      x={showBelow ? x : x + 9}
      y={showBelow ? y + 17 : y + 4}
      textAnchor={showBelow ? 'middle' : 'start'}
      className="fill-foreground font-bold"
      fontSize={fontSize}
      stroke="var(--background)"
      strokeWidth="4"
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {children}
    </text>
  )
}

function CursorTime({ point }: { point: PositionedDiveProfilePoint }) {
  const width = 52
  const x =
    point.x + width + 8 > PROFILE_CHART_VIEWBOX.width - PROFILE_CHART_VIEWBOX.right
      ? point.x - width - 8
      : point.x + 8
  const y = PROFILE_CHART_VIEWBOX.top - 24

  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height="20" rx="5" className="fill-foreground" />
      <text
        x={width / 2}
        y="14"
        textAnchor="middle"
        className="fill-background text-[11px] font-bold"
      >
        {formatElapsedTime(point.elapsedSeconds)}
      </text>
    </g>
  )
}

function ProfileMagnifier({
  geometry,
  selectedPoint,
}: {
  geometry: ReturnType<typeof createProfileGeometry>
  selectedPoint: PositionedDiveProfilePoint
}) {
  const viewBox = createProfileMagnifierViewBox(selectedPoint, geometry.plotWidth)
  const showOnLeft = selectedPoint.x > PROFILE_CHART_VIEWBOX.width / 2
  const viewBoxScaleCompensation = viewBox.width / 360
  const cursorRadius = 4 * viewBoxScaleCompensation
  const cursorFontSize = 11 * viewBoxScaleCompensation

  return (
    <aside
      aria-label="Magnified dive profile"
      className={`pointer-events-none absolute top-3 z-10 w-[22.5rem] overflow-hidden rounded-xl border-2 border-border bg-background shadow-lg ${showOnLeft ? 'left-3' : 'right-3'}`}
    >
      <p className="border-b border-border bg-background/95 px-3 py-2 text-xs font-bold">
        Magnified · {formatElapsedTime(selectedPoint.elapsedSeconds)}
      </p>
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full bg-background"
        style={{ aspectRatio: `${viewBox.width} / ${viewBox.height}` }}
        role="img"
        aria-label={`Magnified profile at ${formatElapsedTime(selectedPoint.elapsedSeconds)}`}
      >
        <title>Magnified dive profile around the selected time</title>
        {geometry.depthTicks.map((tick) => (
          <line
            key={tick.depthMeters}
            x1={PROFILE_CHART_VIEWBOX.left}
            x2={PROFILE_CHART_VIEWBOX.width - PROFILE_CHART_VIEWBOX.right}
            y1={tick.y}
            y2={tick.y}
            className="stroke-border"
            strokeDasharray={tick.depthMeters === 0 ? undefined : '4 7'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={geometry.depthPath}
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {geometry.ceilingViolationPath ? (
          <path
            d={geometry.ceilingViolationPath}
            fill="none"
            className="stroke-red-500"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {geometry.ceilingPath ? (
          <path
            d={geometry.ceilingPath}
            fill="none"
            className="stroke-red-500"
            strokeWidth="2.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <line
          x1={selectedPoint.x}
          x2={selectedPoint.x}
          y1={viewBox.y}
          y2={viewBox.y + viewBox.height}
          className="stroke-foreground/50"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {selectedPoint.ceilingY === null ? null : (
          <>
            <CursorDot
              x={selectedPoint.x}
              y={selectedPoint.ceilingY}
              radius={cursorRadius}
              className="fill-red-500"
            />
            <CursorValue
              x={selectedPoint.x}
              y={selectedPoint.ceilingY}
              fontSize={cursorFontSize}
            >
              {`${selectedPoint.decoCeilingMeters?.toFixed(0)} m`}
            </CursorValue>
          </>
        )}
        <CursorDot
          x={selectedPoint.x}
          y={selectedPoint.depthY}
          radius={cursorRadius}
          className="fill-primary"
        />
        <CursorValue
          x={selectedPoint.x}
          y={selectedPoint.depthY}
          fontSize={cursorFontSize}
        >
          {`${selectedPoint.depthMeters.toFixed(1)} m`}
        </CursorValue>
      </svg>
    </aside>
  )
}

export function DiveProfileChart({
  samples,
  tanks,
}: {
  samples: ProfileSample[]
  tanks: ProfileTank[]
}) {
  const gradientId = useId()
  const ceilingGradientId = useId()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const geometry = useMemo(
    () =>
      createProfileGeometry(
        samples.map((sample) => ({
          elapsedSeconds: sample.elapsedSeconds,
          depthMeters: Number(sample.depthMeters),
          temperatureCelsius:
            sample.temperatureCelsius === null ? null : Number(sample.temperatureCelsius),
          pressureBar: sample.pressureBar === null ? null : Number(sample.pressureBar),
          tank1PressureBar:
            sample.tank1PressureBar === null ? null : Number(sample.tank1PressureBar),
          tank2PressureBar:
            sample.tank2PressureBar === null ? null : Number(sample.tank2PressureBar),
          decoCeilingMeters:
            sample.decoCeilingMeters === null ? null : Number(sample.decoCeilingMeters),
          tankNumber: sample.tankNumber,
        })),
      ),
    [samples],
  )
  const selectedPoint =
    selectedIndex === null ? null : (geometry.points[selectedIndex] ?? null)
  const hasTankPressureProfiles = Boolean(
    geometry.tank1PressurePath || geometry.tank2PressurePath,
  )

  function selectFromPointer(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const chartX =
      ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) *
      PROFILE_CHART_VIEWBOX.width
    const index = findNearestProfilePoint(geometry.points, chartX)
    setSelectedIndex(index >= 0 ? index : null)
  }

  function selectFromKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (geometry.points.length === 0) return
    const currentIndex = selectedIndex ?? 0
    let nextIndex = currentIndex
    if (event.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1)
    if (event.key === 'ArrowRight') {
      nextIndex = Math.min(geometry.points.length - 1, currentIndex + 1)
    }
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = geometry.points.length - 1
    if (nextIndex === currentIndex && selectedIndex !== null) return
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    setSelectedIndex(nextIndex)
  }

  const selectedDescription = selectedPoint
    ? [
        formatElapsedTime(selectedPoint.elapsedSeconds),
        `${selectedPoint.depthMeters.toFixed(1)} metres deep`,
        selectedPoint.temperatureCelsius === null
          ? null
          : `${selectedPoint.temperatureCelsius.toFixed(1)} degrees Celsius`,
        selectedPoint.tank1PressureBar === null
          ? null
          : `${tankName(1, tanks)} ${selectedPoint.tank1PressureBar.toFixed(0)} bar`,
        selectedPoint.tank2PressureBar === null
          ? null
          : `${tankName(2, tanks)} ${selectedPoint.tank2PressureBar.toFixed(0)} bar`,
        selectedPoint.tank1PressureBar !== null ||
        selectedPoint.tank2PressureBar !== null ||
        selectedPoint.pressureBar === null
          ? null
          : `${selectedPoint.pressureBar.toFixed(0)} bar active tank pressure`,
        selectedPoint.decoCeilingMeters === null
          ? null
          : `${selectedPoint.decoCeilingMeters.toFixed(0)} metre decompression ceiling`,
        selectedPoint.tankNumber === null
          ? null
          : tankLabel(selectedPoint.tankNumber, tanks),
      ]
        .filter(Boolean)
        .join(', ')
    : 'Use the left and right arrow keys to inspect samples'

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Computer samples
          </p>
          <h2 className="mt-2 text-xl font-semibold">Dive profile</h2>
        </div>
        {geometry.points.length > 0 ? (
          <p className="rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
            {geometry.points.length.toLocaleString()} samples ·{' '}
            {geometry.maximumDepthMeters.toFixed(1)} m recorded
          </p>
        ) : null}
      </div>

      {geometry.points.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center">
          <p className="font-medium">No depth profile is available for this dive.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Summary depth and duration remain available above.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-5 bg-primary" /> Depth
            </span>
            {geometry.ceilingPath ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5 bg-red-500" />
                Deco ceiling
              </span>
            ) : null}
            {geometry.ceilingViolationPath ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-1 w-5 bg-red-500" />
                Depth above ceiling
              </span>
            ) : null}
            {geometry.temperaturePath ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5 bg-orange-500" /> Temperature
              </span>
            ) : null}
            {geometry.tank1PressurePath ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5" style={{ backgroundColor: tankColor(1) }} />
                {tankName(1, tanks)} pressure
              </span>
            ) : null}
            {geometry.tank2PressurePath ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5" style={{ backgroundColor: tankColor(2) }} />
                {tankName(2, tanks)} pressure
              </span>
            ) : null}
            {geometry.pressurePath ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5 bg-violet-500" />{' '}
                {hasTankPressureProfiles
                  ? 'Other active tank pressure'
                  : 'Active tank pressure'}
              </span>
            ) : null}
          </div>

          <div
            role="slider"
            tabIndex={0}
            aria-label="Dive profile sample"
            aria-valuemin={0}
            aria-valuemax={geometry.points.length - 1}
            aria-valuenow={selectedIndex ?? 0}
            aria-valuetext={selectedDescription}
            onFocus={() => setSelectedIndex((current) => current ?? 0)}
            onKeyDown={selectFromKeyboard}
            className="relative mt-4 overflow-x-auto rounded-xl border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg
              viewBox={`0 0 ${PROFILE_CHART_VIEWBOX.width} ${PROFILE_CHART_VIEWBOX.height}`}
              role="img"
              aria-label="Depth, decompression ceiling, temperature, individual tank pressure, and tank switches over elapsed dive time"
              onPointerMove={selectFromPointer}
              onPointerLeave={() => setSelectedIndex(null)}
              className="block h-auto min-h-[32rem] min-w-[48rem] w-full touch-none"
            >
              <title>Dive computer profile</title>
              <desc>
                Depth increases downward. Temperature and the differently colored tank
                pressures use aligned tracks. A red gradient and solid boundary show the
                recorded decompression ceiling. Labeled circular markers on the depth
                trace indicate the active tank and each tank switch.
              </desc>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id={ceilingGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.32" />
                </linearGradient>
              </defs>

              {geometry.depthTicks.map((tick) => (
                <g key={tick.depthMeters}>
                  <line
                    x1={PROFILE_CHART_VIEWBOX.left}
                    x2={PROFILE_CHART_VIEWBOX.width - PROFILE_CHART_VIEWBOX.right}
                    y1={tick.y}
                    y2={tick.y}
                    className="stroke-border"
                    strokeDasharray={tick.depthMeters === 0 ? undefined : '4 7'}
                  />
                  <text
                    x={PROFILE_CHART_VIEWBOX.left - 12}
                    y={tick.y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[12px]"
                  >
                    {tick.depthMeters.toFixed(0)} m
                  </text>
                </g>
              ))}
              <text
                x={PROFILE_CHART_VIEWBOX.left}
                y={PROFILE_CHART_VIEWBOX.top - 12}
                className="fill-foreground text-[12px] font-semibold"
              >
                Depth
              </text>

              {geometry.xTicks.map((tick) => (
                <g key={tick.x}>
                  <line
                    x1={tick.x}
                    x2={tick.x}
                    y1={PROFILE_CHART_VIEWBOX.top}
                    y2={
                      PROFILE_CHART_VIEWBOX.pressureTop +
                      PROFILE_CHART_VIEWBOX.pressureHeight
                    }
                    className="stroke-border"
                    strokeDasharray="4 7"
                  />
                  <text
                    x={tick.x}
                    y={PROFILE_CHART_VIEWBOX.height - 17}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[12px]"
                  >
                    {formatElapsedTime(tick.elapsedSeconds)}
                  </text>
                </g>
              ))}

              <path d={geometry.depthAreaPath} fill={`url(#${gradientId})`} />
              {geometry.ceilingAreaPath ? (
                <path d={geometry.ceilingAreaPath} fill={`url(#${ceilingGradientId})`} />
              ) : null}
              <path
                d={geometry.depthPath}
                fill="none"
                className="stroke-primary"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {geometry.ceilingViolationPath ? (
                <path
                  d={geometry.ceilingViolationPath}
                  fill="none"
                  className="stroke-red-500"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {geometry.ceilingPath ? (
                <path
                  d={geometry.ceilingPath}
                  fill="none"
                  className="stroke-red-500"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {geometry.deepestPoint ? (
                <ChartValueMarker
                  x={geometry.deepestPoint.x}
                  pointY={geometry.deepestPoint.depthY}
                  label={`${geometry.maximumDepthMeters.toFixed(1)} m`}
                  ariaLabel={`Maximum depth ${geometry.maximumDepthMeters.toFixed(1)} metres`}
                  color="var(--primary)"
                />
              ) : null}

              {geometry.temperatureRange ? (
                <TrackBounds
                  top={PROFILE_CHART_VIEWBOX.temperatureTop}
                  height={PROFILE_CHART_VIEWBOX.temperatureHeight}
                  label="Temperature"
                  maximum={`${geometry.temperatureRange.maximum.toFixed(0)}°`}
                  minimum={`${geometry.temperatureRange.minimum.toFixed(0)}°`}
                />
              ) : null}
              {geometry.temperaturePath ? (
                <path
                  d={geometry.temperaturePath}
                  fill="none"
                  className="stroke-orange-500"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {geometry.minimumTemperaturePoint?.temperatureY === null ||
              !geometry.minimumTemperaturePoint ? null : (
                <ChartValueMarker
                  x={geometry.minimumTemperaturePoint.x}
                  pointY={geometry.minimumTemperaturePoint.temperatureY}
                  label={`${geometry.minimumTemperaturePoint.temperatureCelsius?.toFixed(1)} °C`}
                  ariaLabel={`Minimum temperature ${geometry.minimumTemperaturePoint.temperatureCelsius?.toFixed(1)} degrees Celsius`}
                  color="#f97316"
                />
              )}

              {geometry.pressureRange ? (
                <TrackBounds
                  top={PROFILE_CHART_VIEWBOX.pressureTop}
                  height={PROFILE_CHART_VIEWBOX.pressureHeight}
                  label={
                    hasTankPressureProfiles ? 'Tank pressure' : 'Active tank pressure'
                  }
                  maximum={`${geometry.pressureRange.maximum.toFixed(0)}`}
                  minimum="0 bar"
                />
              ) : (
                <text
                  x={PROFILE_CHART_VIEWBOX.left}
                  y={PROFILE_CHART_VIEWBOX.pressureTop + 25}
                  className="fill-muted-foreground text-[12px]"
                >
                  No pressure samples recorded
                </text>
              )}
              {geometry.pressurePath ? (
                <path
                  d={geometry.pressurePath}
                  fill="none"
                  className="stroke-violet-500"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {geometry.tank1PressurePath ? (
                <path
                  d={geometry.tank1PressurePath}
                  fill="none"
                  stroke={tankColor(1)}
                  strokeWidth="2.75"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {geometry.tank2PressurePath ? (
                <path
                  d={geometry.tank2PressurePath}
                  fill="none"
                  stroke={tankColor(2)}
                  strokeWidth="2.75"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {geometry.tankSwitches.map((point) => (
                <TankSwitchMarker
                  key={`${point.elapsedSeconds}-${point.tankNumber}`}
                  point={point}
                  tanks={tanks}
                />
              ))}

              {selectedPoint ? (
                <g>
                  <line
                    x1={selectedPoint.x}
                    x2={selectedPoint.x}
                    y1={PROFILE_CHART_VIEWBOX.top}
                    y2={
                      PROFILE_CHART_VIEWBOX.pressureTop +
                      PROFILE_CHART_VIEWBOX.pressureHeight
                    }
                    className="stroke-foreground/50"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <CursorTime point={selectedPoint} />
                  {selectedPoint.ceilingY === null ? null : (
                    <>
                      <CursorDot
                        x={selectedPoint.x}
                        y={selectedPoint.ceilingY}
                        className="fill-red-500"
                      />
                      <CursorValue x={selectedPoint.x} y={selectedPoint.ceilingY}>
                        {`${selectedPoint.decoCeilingMeters?.toFixed(0)} m`}
                      </CursorValue>
                    </>
                  )}
                  <CursorDot
                    x={selectedPoint.x}
                    y={selectedPoint.depthY}
                    className="fill-primary"
                  />
                  <CursorValue x={selectedPoint.x} y={selectedPoint.depthY}>
                    {`${selectedPoint.depthMeters.toFixed(1)} m`}
                  </CursorValue>
                  {selectedPoint.temperatureY === null ? null : (
                    <>
                      <CursorDot
                        x={selectedPoint.x}
                        y={selectedPoint.temperatureY}
                        className="fill-orange-500"
                      />
                      <CursorValue x={selectedPoint.x} y={selectedPoint.temperatureY}>
                        {`${selectedPoint.temperatureCelsius?.toFixed(1)} °C`}
                      </CursorValue>
                    </>
                  )}
                  {selectedPoint.tank1PressureY === null ? null : (
                    <>
                      <CursorDot
                        x={selectedPoint.x}
                        y={selectedPoint.tank1PressureY}
                        fill={tankColor(1)}
                      />
                      <CursorValue x={selectedPoint.x} y={selectedPoint.tank1PressureY}>
                        {`${selectedPoint.tank1PressureBar?.toFixed(0)} bar`}
                      </CursorValue>
                    </>
                  )}
                  {selectedPoint.tank2PressureY === null ? null : (
                    <>
                      <CursorDot
                        x={selectedPoint.x}
                        y={selectedPoint.tank2PressureY}
                        fill={tankColor(2)}
                      />
                      <CursorValue x={selectedPoint.x} y={selectedPoint.tank2PressureY}>
                        {`${selectedPoint.tank2PressureBar?.toFixed(0)} bar`}
                      </CursorValue>
                    </>
                  )}
                  {selectedPoint.pressureY === null ||
                  selectedPoint.tank1PressureY !== null ||
                  selectedPoint.tank2PressureY !== null ? null : (
                    <>
                      <CursorDot
                        x={selectedPoint.x}
                        y={selectedPoint.pressureY}
                        className="fill-violet-500"
                      />
                      <CursorValue x={selectedPoint.x} y={selectedPoint.pressureY}>
                        {`${selectedPoint.pressureBar?.toFixed(0)} bar`}
                      </CursorValue>
                    </>
                  )}
                </g>
              ) : null}
            </svg>
            {selectedPoint ? (
              <ProfileMagnifier geometry={geometry} selectedPoint={selectedPoint} />
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-6">
            <p className="rounded-lg bg-muted/60 px-3 py-2">
              <span className="block text-xs text-muted-foreground">Time</span>
              <span className="font-mono font-semibold">
                {selectedPoint ? formatElapsedTime(selectedPoint.elapsedSeconds) : '—'}
              </span>
            </p>
            <p className="rounded-lg bg-muted/60 px-3 py-2">
              <span className="block text-xs text-muted-foreground">Depth</span>
              <span className="font-mono font-semibold">
                {selectedPoint ? `${selectedPoint.depthMeters.toFixed(1)} m` : '—'}
              </span>
            </p>
            <p className="rounded-lg bg-muted/60 px-3 py-2">
              <span className="block text-xs text-muted-foreground">Deco ceiling</span>
              <span className="font-mono font-semibold text-red-600">
                {selectedPoint?.decoCeilingMeters
                  ? `${selectedPoint.decoCeilingMeters.toFixed(0)} m`
                  : 'None'}
              </span>
            </p>
            <p className="rounded-lg bg-muted/60 px-3 py-2">
              <span className="block text-xs text-muted-foreground">Temperature</span>
              <span className="font-mono font-semibold">
                {selectedPoint?.temperatureCelsius === null || !selectedPoint
                  ? '—'
                  : `${selectedPoint.temperatureCelsius.toFixed(1)} °C`}
              </span>
            </p>
            <p className="rounded-lg bg-muted/60 px-3 py-2">
              <span className="block text-xs text-muted-foreground">Tank pressure</span>
              {selectedPoint &&
              (selectedPoint.tank1PressureBar !== null ||
                selectedPoint.tank2PressureBar !== null) ? (
                <span className="mt-1 block space-y-1 font-mono text-xs font-semibold">
                  {selectedPoint.tank1PressureBar === null ? null : (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tankColor(1) }}
                      />
                      {tankName(1, tanks)} {selectedPoint.tank1PressureBar.toFixed(0)}
                      bar
                    </span>
                  )}
                  {selectedPoint.tank2PressureBar === null ? null : (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tankColor(2) }}
                      />
                      {tankName(2, tanks)} {selectedPoint.tank2PressureBar.toFixed(0)}
                      bar
                    </span>
                  )}
                </span>
              ) : (
                <span className="font-mono font-semibold">
                  {selectedPoint?.pressureBar === null || !selectedPoint
                    ? '—'
                    : `${selectedPoint.pressureBar.toFixed(0)} bar`}
                </span>
              )}
            </p>
            <p className="rounded-lg bg-muted/60 px-3 py-2">
              <span className="block text-xs text-muted-foreground">Active tank</span>
              <span className="block truncate font-semibold">
                {selectedPoint?.tankNumber
                  ? tankLabel(selectedPoint.tankNumber, tanks)
                  : '—'}
              </span>
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hover or use arrow keys to inspect.{' '}
            {hasTankPressureProfiles
              ? 'Tank transmitter traces share one pressure scale and use their tank colors. '
              : ''}
            Missing segments mean the dive computer recorded no transmitter value.
          </p>
        </>
      )}
    </section>
  )
}
