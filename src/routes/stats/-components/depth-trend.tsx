import { useState } from 'react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

export interface DepthTrendPoint {
  month: string
  averageDepthMeters: string | null
  averageMaximumDepthMeters: string | null
  diveCount: number
}

const HEIGHT = 240
const PAD_LEFT = 40
const PAD_RIGHT = 16
const PAD_TOP = 12
const PAD_BOTTOM = 28

function monthIndex(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return (year ?? 0) * 12 + (monthNumber ?? 1) - 1
}

function monthTitle(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

interface HoveredMonth {
  point: DepthTrendPoint
  clientX: number
  clientY: number
}

// Monthly average depths over the whole logbook, with the depth axis growing
// downward the way divers read profile charts. Hovering the chart highlights
// the nearest month and shows its values.
export function DepthTrend({ points }: { points: DepthTrendPoint[] }) {
  const [hovered, setHovered] = useState<HoveredMonth | null>(null)

  const withDepth = points.filter(
    (point) =>
      point.averageDepthMeters !== null || point.averageMaximumDepthMeters !== null,
  )
  if (withDepth.length < 2) return null

  const firstIndex = monthIndex(withDepth[0]?.month ?? '')
  const lastIndex = monthIndex(withDepth[withDepth.length - 1]?.month ?? '')
  const span = Math.max(1, lastIndex - firstIndex)
  const step = Math.max(9, Math.min(28, Math.floor(820 / span)))
  const width = PAD_LEFT + PAD_RIGHT + span * step
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const plotBottom = PAD_TOP + plotHeight

  const deepest = Math.max(
    5,
    ...withDepth.map((point) =>
      Math.max(
        Number(point.averageDepthMeters ?? 0),
        Number(point.averageMaximumDepthMeters ?? 0),
      ),
    ),
  )
  const depthCeiling = Math.ceil(deepest / 5) * 5
  const gridStep = depthCeiling > 25 ? 10 : 5

  const x = (month: string) => PAD_LEFT + (monthIndex(month) - firstIndex) * step
  const y = (depth: number) => PAD_TOP + (depth / depthCeiling) * plotHeight

  const series = (key: 'averageDepthMeters' | 'averageMaximumDepthMeters') =>
    withDepth
      .filter((point) => point[key] !== null)
      .map((point) => ({
        month: point.month,
        x: x(point.month),
        y: y(Number(point[key])),
      }))

  const averageMaxSeries = series('averageMaximumDepthMeters')
  const averageSeries = series('averageDepthMeters')

  const gridDepths: number[] = []
  for (let depth = 0; depth <= depthCeiling; depth += gridStep) gridDepths.push(depth)

  const yearTicks: { x: number; year: string }[] = []
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    if (index % 12 !== 0) continue
    yearTicks.push({
      x: PAD_LEFT + (index - firstIndex) * step,
      year: String(Math.floor(index / 12)),
    })
  }

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    let nearest: DepthTrendPoint | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const point of withDepth) {
      const distance = Math.abs(x(point.month) - pointerX)
      if (distance < nearestDistance) {
        nearest = point
        nearestDistance = distance
      }
    }
    if (!nearest) return
    setHovered({
      point: nearest,
      clientX: rect.left + x(nearest.month),
      clientY: rect.top + PAD_TOP,
    })
  }

  const hoveredX = hovered ? x(hovered.point.month) : null

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">Average depth per month</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-primary" aria-hidden="true" />
            Avg max depth
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-primary/40" aria-hidden="true" />
            Avg depth
          </span>
        </div>
      </div>
      <ScrollArea className="pb-1">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Average dive depth per month across the logbook"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          {gridDepths.map((depth) => (
            <g key={depth}>
              <line
                x1={PAD_LEFT}
                x2={width - PAD_RIGHT}
                y1={y(depth)}
                y2={y(depth)}
                className="stroke-border"
                strokeWidth="1"
              />
              <text
                x={PAD_LEFT - 8}
                y={y(depth) + 3}
                textAnchor="end"
                fontSize="10"
                className="fill-muted-foreground"
              >
                {depth}m
              </text>
            </g>
          ))}
          {yearTicks.map((tick) => (
            <g key={tick.year}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={PAD_TOP}
                y2={plotBottom}
                className="stroke-border"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
              <text
                x={tick.x}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize="10"
                className="fill-muted-foreground"
              >
                {tick.year}
              </text>
            </g>
          ))}
          {hoveredX !== null ? (
            <line
              x1={hoveredX}
              x2={hoveredX}
              y1={PAD_TOP}
              y2={plotBottom}
              strokeWidth="1"
              className="stroke-muted-foreground/60"
            />
          ) : null}
          {[
            {
              seriesPoints: averageMaxSeries,
              lineClass: 'stroke-primary',
              dotClass: 'fill-primary',
            },
            {
              seriesPoints: averageSeries,
              lineClass: 'stroke-primary/40',
              dotClass: 'fill-primary/40',
            },
          ].map(({ seriesPoints, lineClass, dotClass }) => (
            <g key={lineClass}>
              <polyline
                points={seriesPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                className={lineClass}
              />
              {seriesPoints.map((point) => (
                <circle
                  key={point.month}
                  cx={point.x}
                  cy={point.y}
                  r={hovered?.point.month === point.month ? 4 : 2.5}
                  className={dotClass}
                />
              ))}
            </g>
          ))}
        </svg>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {hovered ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-border bg-card p-3 shadow-xl"
          style={{ left: hovered.clientX, top: hovered.clientY - 8 }}
        >
          <p className="text-xs font-semibold">
            {monthTitle(hovered.point.month)} · {hovered.point.diveCount}{' '}
            {hovered.point.diveCount === 1 ? 'dive' : 'dives'}
          </p>
          <div className="mt-1.5 space-y-1 text-xs">
            {hovered.point.averageMaximumDepthMeters !== null ? (
              <p className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full bg-primary" aria-hidden="true" />
                <span className="text-muted-foreground">Avg max depth</span>
                <span className="font-mono font-semibold">
                  {Number(hovered.point.averageMaximumDepthMeters).toFixed(1)} m
                </span>
              </p>
            ) : null}
            {hovered.point.averageDepthMeters !== null ? (
              <p className="flex items-center gap-1.5">
                <span
                  className="h-0.5 w-3 rounded-full bg-primary/40"
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">Avg depth</span>
                <span className="font-mono font-semibold">
                  {Number(hovered.point.averageDepthMeters).toFixed(1)} m
                </span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}
