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

interface SeriesPoint {
  x: number
  y: number
  title: string
}

function Series({
  points,
  lineClass,
  dotClass,
}: {
  points: SeriesPoint[]
  lineClass: string
  dotClass: string
}) {
  return (
    <g>
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={lineClass}
      />
      {points.map((point) => (
        <circle key={`${point.x}`} cx={point.x} cy={point.y} r="2.5" className={dotClass}>
          <title>{point.title}</title>
        </circle>
      ))}
    </g>
  )
}

// Monthly average depths over the whole logbook, with the depth axis growing
// downward the way divers read profile charts.
export function DepthTrend({ points }: { points: DepthTrendPoint[] }) {
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

  const series = (
    key: 'averageDepthMeters' | 'averageMaximumDepthMeters',
    label: string,
  ) =>
    withDepth
      .filter((point) => point[key] !== null)
      .map((point) => ({
        x: x(point.month),
        y: y(Number(point[key])),
        title: `${label} ${Number(point[key]).toFixed(1)} m · ${monthTitle(point.month)} (${point.diveCount} ${point.diveCount === 1 ? 'dive' : 'dives'})`,
      }))

  const averageMaxSeries = series('averageMaximumDepthMeters', 'Avg max depth')
  const averageSeries = series('averageDepthMeters', 'Avg depth')

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
      <div className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Average dive depth per month across the logbook"
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
          <Series
            points={averageMaxSeries}
            lineClass="stroke-primary"
            dotClass="fill-primary"
          />
          <Series
            points={averageSeries}
            lineClass="stroke-primary/40"
            dotClass="fill-primary/40"
          />
        </svg>
      </div>
    </article>
  )
}
