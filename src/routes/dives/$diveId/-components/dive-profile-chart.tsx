import { useId, useMemo, useState } from 'react'
import {
  createProfileGeometry,
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

function tankLabel(tankNumber: number, tanks: ProfileTank[]) {
  const tank = tanks.find((item) => item.computerTankNumber === tankNumber)
  if (!tank) return `Tank ${tankNumber}`
  return `${tank.name || `Tank ${tankNumber}`} · ${gasName(tank)}`
}

function tankName(tankNumber: number, tanks: ProfileTank[]) {
  const tank = tanks.find((item) => item.computerTankNumber === tankNumber)
  return tank?.name || `Tank ${tankNumber}`
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

export function DiveProfileChart({
  samples,
  tanks,
}: {
  samples: ProfileSample[]
  tanks: ProfileTank[]
}) {
  const gradientId = useId()
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
  const tankNumbers = Array.from(
    new Set(geometry.points.flatMap((point) => point.tankNumber ?? [])),
  ).sort((left, right) => left - right)

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
                <span className="h-0.5 w-5 border-t-2 border-dashed border-red-500" />
                Deco ceiling
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
            className="mt-4 overflow-x-auto rounded-xl border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                pressures use aligned tracks. Dashed red segments show the recorded
                decompression ceiling. Colored vertical markers indicate tank switches.
              </desc>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.3" />
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
              <path
                d={geometry.depthPath}
                fill="none"
                className="stroke-primary"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {geometry.ceilingPath ? (
                <path
                  d={geometry.ceilingPath}
                  fill="none"
                  className="stroke-red-500"
                  strokeWidth="2.5"
                  strokeDasharray="7 5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
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

              {geometry.tankSwitches.slice(1).map((point) =>
                point.tankNumber === null ? null : (
                  <g key={`${point.elapsedSeconds}-${point.tankNumber}`}>
                    <line
                      x1={point.x}
                      x2={point.x}
                      y1={PROFILE_CHART_VIEWBOX.top}
                      y2={
                        PROFILE_CHART_VIEWBOX.pressureTop +
                        PROFILE_CHART_VIEWBOX.pressureHeight
                      }
                      stroke={tankColor(point.tankNumber)}
                      strokeWidth="1.5"
                      strokeDasharray="3 5"
                      opacity="0.7"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={point.x}
                      cy={PROFILE_CHART_VIEWBOX.top - 8}
                      r="5"
                      fill={tankColor(point.tankNumber)}
                    />
                  </g>
                ),
              )}

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
                  <circle
                    cx={selectedPoint.x}
                    cy={selectedPoint.depthY}
                    r="6"
                    className="fill-background stroke-primary"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                  {selectedPoint.tank1PressureY === null ? null : (
                    <circle
                      cx={selectedPoint.x}
                      cy={selectedPoint.tank1PressureY}
                      r="4.5"
                      fill={tankColor(1)}
                      className="stroke-background"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {selectedPoint.tank2PressureY === null ? null : (
                    <circle
                      cx={selectedPoint.x}
                      cy={selectedPoint.tank2PressureY}
                      r="4.5"
                      fill={tankColor(2)}
                      className="stroke-background"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              ) : null}
            </svg>
          </div>

          {tankNumbers.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {tankNumbers.map((tankNumber) => (
                <span
                  key={tankNumber}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tankColor(tankNumber) }}
                  />
                  {tankLabel(tankNumber, tanks)}
                </span>
              ))}
              {geometry.tankSwitches.length > 1 ? (
                <span className="px-2 py-1.5 text-xs text-muted-foreground">
                  {geometry.tankSwitches.length - 1} recorded switches
                </span>
              ) : null}
            </div>
          ) : null}

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
