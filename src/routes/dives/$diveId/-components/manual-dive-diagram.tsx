import { useId } from 'react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

interface ManualDiveSummary {
  captureSource: 'manual' | 'computer'
  durationSeconds: number
  surfaceIntervalSeconds: number | null
  maximumDepthMeters: string | null
  averageDepthMeters: string | null
  safetyStop: boolean
  safetyStopSeconds: number | null
  pressureGroupBeforeInterval: string | null
  pressureGroupAfterInterval: string | null
  pressureGroupEnd: string | null
  residualNitrogenSeconds: number | null
}

const VIEWBOX = { width: 720, height: 324 }
const SURFACE_Y = 96
const BOTTOM_Y = 236
const STOP_Y = 168

const PROFILE = {
  surfaceStart: 40,
  descentTop: 260,
  descentBottom: 272,
  bottomEnd: 456,
  stopStart: 500,
  stopEnd: 548,
  surfaceReturn: 560,
  surfaceEnd: 680,
}

function minutes(seconds: number | null) {
  return seconds === null ? null : Math.round(seconds / 60)
}

function minutesLabel(seconds: number | null) {
  const value = minutes(seconds)
  return value === null ? '—' : `${value} min`
}

function clockLabel(seconds: number | null) {
  if (seconds === null) return '—'
  const total = Math.round(seconds / 60)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function depthLabel(value: string | null) {
  return value === null ? '—' : `${Number(value).toFixed(1)} m`
}

function profilePath(safetyStop: boolean) {
  const descent = `M ${PROFILE.surfaceStart} ${SURFACE_Y} H ${PROFILE.descentTop} L ${PROFILE.descentBottom} ${BOTTOM_Y} H ${PROFILE.bottomEnd}`
  const ascent = safetyStop
    ? `L ${PROFILE.stopStart} ${STOP_Y} H ${PROFILE.stopEnd} L ${PROFILE.surfaceReturn} ${SURFACE_Y}`
    : `L ${PROFILE.surfaceReturn} ${SURFACE_Y}`
  return `${descent} ${ascent} H ${PROFILE.surfaceEnd}`
}

function LogBox({
  x,
  width,
  label,
  value,
}: {
  x: number
  width: number
  label: string
  value: string
}) {
  const y = 24
  const height = 52
  const empty = value === '—'
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="8"
        className="fill-background stroke-border"
        strokeWidth="1.5"
      />
      <text
        x={x + 8}
        y={y + 15}
        className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wide"
      >
        {label}
      </text>
      <text
        x={x + width / 2}
        y={y + 40}
        textAnchor="middle"
        className={`font-mono text-[16px] font-bold ${empty ? 'fill-muted-foreground/60' : 'fill-foreground'}`}
      >
        {value}
      </text>
    </g>
  )
}

function SumTerm({ x, label, value }: { x: number; label: string; value: string }) {
  const empty = value === '—'
  return (
    <g>
      <text
        x={x}
        y={284}
        textAnchor="middle"
        className={`font-mono text-[15px] font-bold ${empty ? 'fill-muted-foreground/60' : 'fill-foreground'}`}
      >
        {value}
      </text>
      <line x1={x - 32} x2={x + 32} y1={291} y2={291} className="stroke-border" />
      <text
        x={x}
        y={306}
        textAnchor="middle"
        className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wide"
      >
        {label}
      </text>
    </g>
  )
}

export function ManualDiveDiagram({ dive }: { dive: ManualDiveSummary }) {
  const gradientId = useId()
  const residual = minutes(dive.residualNitrogenSeconds)
  const bottom = minutes(dive.durationSeconds)
  const totalBottomTime = residual === null || bottom === null ? null : residual + bottom
  const linePath = profilePath(dive.safetyStop)
  const fillPath = `${linePath} V ${SURFACE_Y} H ${PROFILE.surfaceStart} Z`

  const description = [
    `${minutesLabel(dive.durationSeconds)} bottom time`,
    `maximum depth ${depthLabel(dive.maximumDepthMeters)}`,
    `average depth ${depthLabel(dive.averageDepthMeters)}`,
    dive.safetyStop
      ? `safety stop ${minutesLabel(dive.safetyStopSeconds)}`
      : 'no safety stop',
    dive.surfaceIntervalSeconds === null
      ? null
      : `surface interval ${clockLabel(dive.surfaceIntervalSeconds)}`,
    dive.pressureGroupEnd ? `ending pressure group ${dive.pressureGroupEnd}` : null,
    totalBottomTime === null ? null : `total bottom time ${totalBottomTime} min`,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {dive.captureSource === 'manual' ? 'Manual entry' : 'No computer samples'}
          </p>
          <h2 className="mt-2 text-xl font-semibold">Dive profile</h2>
        </div>
        <p className="rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
          Schematic · not to scale
        </p>
      </div>

      <ScrollArea className="mt-5 rounded-xl border border-border bg-background">
        <svg
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
          role="img"
          aria-label={`Logbook dive diagram: ${description}`}
          className="block h-auto min-w-[40rem] w-full"
        >
          <title>Logbook dive diagram</title>
          <desc>
            A paper-logbook style sketch: pressure groups around the surface interval, a
            descent to the bottom time, an optional safety-stop step on the ascent, and
            residual nitrogen plus bottom time giving total bottom time.
          </desc>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.22" />
            </linearGradient>
          </defs>

          <LogBox
            x={40}
            width={64}
            label="PG"
            value={dive.pressureGroupBeforeInterval ?? '—'}
          />
          <LogBox
            x={104}
            width={96}
            label="SI"
            value={clockLabel(dive.surfaceIntervalSeconds)}
          />
          <LogBox
            x={200}
            width={64}
            label="PG"
            value={dive.pressureGroupAfterInterval ?? '—'}
          />
          <LogBox x={616} width={64} label="PG" value={dive.pressureGroupEnd ?? '—'} />

          <path d={fillPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            className="stroke-primary"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          <g>
            <text x={60} y={140} className="fill-foreground text-[15px] font-semibold">
              Depth
            </text>
            <text x={60} y={176} className="fill-muted-foreground text-[12px]">
              Avg
            </text>
            <text
              x={112}
              y={176}
              className="fill-foreground font-mono text-[14px] font-bold"
            >
              {depthLabel(dive.averageDepthMeters)}
            </text>
            <text x={60} y={206} className="fill-muted-foreground text-[12px]">
              Max
            </text>
            <text
              x={112}
              y={206}
              className="fill-foreground font-mono text-[14px] font-bold"
            >
              {depthLabel(dive.maximumDepthMeters)}
            </text>
          </g>

          <text
            x={(PROFILE.descentBottom + PROFILE.bottomEnd) / 2}
            y={BOTTOM_Y - 14}
            textAnchor="middle"
            className="fill-foreground font-mono text-[15px] font-bold"
          >
            {minutesLabel(dive.durationSeconds)}
          </text>

          <g>
            <rect
              x={574}
              y={STOP_Y - 8}
              width={14}
              height={14}
              rx="3"
              className={
                dive.safetyStop
                  ? 'fill-primary stroke-primary'
                  : 'fill-background stroke-border'
              }
              strokeWidth="1.5"
            />
            {dive.safetyStop ? (
              <path
                d={`M 577 ${STOP_Y - 1} L 580.5 ${STOP_Y + 2.5} L 586 ${STOP_Y - 4}`}
                fill="none"
                className="stroke-primary-foreground"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            <text
              x={596}
              y={STOP_Y + 4}
              className={`text-[13px] font-semibold ${dive.safetyStop ? 'fill-foreground' : 'fill-muted-foreground'}`}
            >
              SS
            </text>
            <text
              x={620}
              y={STOP_Y + 4}
              className={`font-mono text-[13px] font-bold ${dive.safetyStop ? 'fill-foreground' : 'fill-muted-foreground/60'}`}
            >
              {dive.safetyStop ? minutesLabel(dive.safetyStopSeconds) : '—'}
            </text>
          </g>

          <g>
            <SumTerm
              x={452}
              label="RNT"
              value={residual === null ? '—' : `${residual}`}
            />
            <text
              x={502}
              y={284}
              textAnchor="middle"
              className="fill-muted-foreground text-[16px]"
            >
              +
            </text>
            <SumTerm x={552} label="ABT" value={bottom === null ? '—' : `${bottom}`} />
            <text
              x={602}
              y={284}
              textAnchor="middle"
              className="fill-muted-foreground text-[16px]"
            >
              =
            </text>
            <SumTerm
              x={652}
              label="TBT"
              value={totalBottomTime === null ? '—' : `${totalBottomTime}`}
            />
          </g>
        </svg>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <p className="mt-3 text-xs text-muted-foreground">
        PG is the dive-table pressure group, SI the surface interval, SS the safety stop.
        Residual nitrogen time (RNT) plus actual bottom time (ABT) gives total bottom time
        (TBT), all in minutes.
      </p>
    </section>
  )
}
