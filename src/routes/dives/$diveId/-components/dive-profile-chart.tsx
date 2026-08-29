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
}

function formatElapsedTime(totalSeconds: number) {
  const roundedSeconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(roundedSeconds / 60)
  const seconds = roundedSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function DiveProfileChart({ samples }: { samples: ProfileSample[] }) {
  const gradientId = useId()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const geometry = useMemo(
    () =>
      createProfileGeometry(
        samples.map((sample) => ({
          elapsedSeconds: sample.elapsedSeconds,
          depthMeters: Number(sample.depthMeters),
        })),
      ),
    [samples],
  )
  const selectedPoint =
    selectedIndex === null ? null : (geometry.points[selectedIndex] ?? null)

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

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Depth over time
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
          <div
            role="slider"
            tabIndex={0}
            aria-label="Dive profile sample"
            aria-valuemin={0}
            aria-valuemax={geometry.points.length - 1}
            aria-valuenow={selectedIndex ?? 0}
            aria-valuetext={
              selectedPoint
                ? `${formatElapsedTime(selectedPoint.elapsedSeconds)}, ${selectedPoint.depthMeters.toFixed(1)} metres deep`
                : 'Use the left and right arrow keys to inspect samples'
            }
            onFocus={() => setSelectedIndex((current) => current ?? 0)}
            onKeyDown={selectFromKeyboard}
            className="mt-6 overflow-hidden rounded-xl border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg
              viewBox={`0 0 ${PROFILE_CHART_VIEWBOX.width} ${PROFILE_CHART_VIEWBOX.height}`}
              role="img"
              aria-label="Depth over elapsed dive time"
              onPointerMove={selectFromPointer}
              onPointerLeave={() => setSelectedIndex(null)}
              className="block h-auto min-h-64 w-full touch-none"
            >
              <title>Dive depth profile</title>
              <desc>
                Depth increases downward. The horizontal axis shows elapsed dive time.
              </desc>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              {geometry.yTicks.map((tick) => (
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
              {geometry.xTicks.map((tick) => (
                <g key={tick.x}>
                  <line
                    x1={tick.x}
                    x2={tick.x}
                    y1={PROFILE_CHART_VIEWBOX.top}
                    y2={PROFILE_CHART_VIEWBOX.height - PROFILE_CHART_VIEWBOX.bottom}
                    className="stroke-border"
                    strokeDasharray="4 7"
                  />
                  <text
                    x={tick.x}
                    y={PROFILE_CHART_VIEWBOX.height - 20}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[12px]"
                  >
                    {formatElapsedTime(tick.elapsedSeconds)}
                  </text>
                </g>
              ))}

              <path
                d={geometry.areaPath}
                fill={`url(#${gradientId})`}
                className="text-primary"
              />
              <path
                d={geometry.linePath}
                fill="none"
                className="stroke-primary"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {selectedPoint ? (
                <g>
                  <line
                    x1={selectedPoint.x}
                    x2={selectedPoint.x}
                    y1={PROFILE_CHART_VIEWBOX.top}
                    y2={PROFILE_CHART_VIEWBOX.height - PROFILE_CHART_VIEWBOX.bottom}
                    className="stroke-foreground/40"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={selectedPoint.x}
                    cy={selectedPoint.y}
                    r="6"
                    className="fill-background stroke-primary"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ) : null}
            </svg>
          </div>
          <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">Hover or use arrow keys to inspect.</p>
            <p aria-live="polite" className="font-mono font-semibold text-primary">
              {selectedPoint
                ? `${formatElapsedTime(selectedPoint.elapsedSeconds)} · ${selectedPoint.depthMeters.toFixed(1)} m`
                : 'Time · depth'}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
