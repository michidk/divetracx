import { Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { formatDiveDate, formatMeters } from '@/modules/dives/format'

const DAY_MS = 86_400_000
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const

// Sequential single-hue scale: zero stays on the muted surface, activity
// steps through primary opacity levels up to full primary.
const LEVEL_CLASSES = [
  'bg-muted',
  'bg-primary/30',
  'bg-primary/55',
  'bg-primary/75',
  'bg-primary',
] as const

export interface CalendarDive {
  id: string
  date: string
  number: number | null
  durationSeconds: number
  maximumDepthMeters: string | null
  siteName: string | null
}

function isoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

// Weeks as columns, Monday-first, GitHub-contribution style. Cells outside
// the year stay null so the first and last columns render partial weeks.
function buildYearWeeks(year: number) {
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  const firstWeekday = (new Date(start).getUTCDay() + 6) % 7
  const weeks: (string | null)[][] = []
  for (let ms = start, index = firstWeekday; ms < end; ms += DAY_MS, index += 1) {
    const weekIndex = Math.floor(index / 7)
    if (!weeks[weekIndex]) weeks[weekIndex] = Array<string | null>(7).fill(null)
    weeks[weekIndex][index % 7] = isoDate(ms)
  }
  return weeks
}

function monthLabel(week: (string | null)[]) {
  const monthStart = week.find((date) => date?.endsWith('-01'))
  if (!monthStart) return null
  return new Date(`${monthStart}T00:00:00Z`).toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
}

function cellLabel(date: string, diveCount: number) {
  const dives =
    diveCount === 0 ? 'No dives' : diveCount === 1 ? '1 dive' : `${diveCount} dives`
  return `${dives} on ${formatDiveDate(date, 'medium')}`
}

export function DiveHeatmap({
  years,
  calendarDives,
}: {
  years: { year: number; diveCount: number }[]
  calendarDives: CalendarDive[]
}) {
  const [selectedYear, setSelectedYear] = useState(years[0]?.year)
  const [hoveredDate, setHoveredDate] = useState<{
    date: string
    x: number
    y: number
  } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = years.find((entry) => entry.year === selectedYear) ?? years[0]
  if (!selected) return null

  const divesByDate = new Map<string, CalendarDive[]>()
  for (const dive of calendarDives) {
    const entries = divesByDate.get(dive.date) ?? []
    entries.push(dive)
    divesByDate.set(dive.date, entries)
  }
  const maxDaily = Math.max(1, ...[...divesByDate.values()].map((list) => list.length))
  const levelFor = (diveCount: number) =>
    diveCount === 0
      ? 0
      : Math.max(1, Math.ceil((diveCount / maxDaily) * (LEVEL_CLASSES.length - 1)))
  const weeks = buildYearWeeks(selected.year)

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setHoveredDate(null), 150)
  }
  const openCard = (element: HTMLElement, date: string) => {
    cancelClose()
    const rect = element.getBoundingClientRect()
    const x = Math.min(Math.max(rect.left + rect.width / 2, 132), window.innerWidth - 132)
    setHoveredDate({ date, x, y: rect.top })
  }

  const hoveredDives = hoveredDate ? (divesByDate.get(hoveredDate.date) ?? []) : []

  return (
    <div className="relative lg:pr-28">
      <article className="min-w-0 rounded-2xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-semibold">
          {selected.diveCount.toLocaleString()}{' '}
          {selected.diveCount === 1 ? 'dive' : 'dives'} in {selected.year}
        </p>
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex flex-col">
            <div className="mb-1 flex gap-[3px] pl-9">
              {weeks.map((week, weekIndex) => {
                const label = monthLabel(week)
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: weeks are positional
                    key={weekIndex}
                    className="relative h-4 w-[11px]"
                  >
                    {label ? (
                      <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] text-muted-foreground">
                        {label}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-[3px]">
              <div className="flex w-9 flex-col gap-[3px]">
                {WEEKDAY_LABELS.map((label, dayIndex) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: weekdays are positional
                    key={dayIndex}
                    className="h-[11px] text-[10px] leading-[11px] text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
              {weeks.map((week, weekIndex) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: weeks are positional
                  key={weekIndex}
                  className="flex flex-col gap-[3px]"
                >
                  {week.map((date, dayIndex) => {
                    if (!date) {
                      return (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: days are positional
                          key={dayIndex}
                          className="size-[11px]"
                        />
                      )
                    }
                    const dayCount = divesByDate.get(date)?.length ?? 0
                    return (
                      <button
                        key={date}
                        type="button"
                        tabIndex={-1}
                        aria-label={cellLabel(date, dayCount)}
                        onMouseEnter={(event) => openCard(event.currentTarget, date)}
                        onMouseLeave={scheduleClose}
                        onClick={(event) => openCard(event.currentTarget, date)}
                        className={`size-[11px] rounded-[3px] hover:ring-1 hover:ring-foreground/60 ${LEVEL_CLASSES[levelFor(dayCount)]}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span>Less</span>
          {LEVEL_CLASSES.map((levelClass) => (
            <span
              key={levelClass}
              className={`size-[11px] rounded-[3px] ${levelClass}`}
            />
          ))}
          <span>More</span>
        </div>
      </article>

      <nav
        aria-label="Calendar year"
        className="mt-4 flex flex-row flex-wrap gap-2 lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:w-24 lg:flex-col lg:flex-nowrap lg:overflow-y-auto lg:pr-1"
      >
        {years.map((entry) => (
          <button
            key={entry.year}
            type="button"
            aria-pressed={entry.year === selected.year}
            onClick={() => {
              setSelectedYear(entry.year)
              setHoveredDate(null)
            }}
            className={`min-h-9 shrink-0 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              entry.year === selected.year
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            {entry.year}
          </button>
        ))}
      </nav>

      {hoveredDate ? (
        <div
          role="tooltip"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className={`fixed z-50 w-max max-w-72 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-card p-3 shadow-xl ${hoveredDives.length === 0 ? 'pointer-events-none' : ''}`}
          style={{ left: hoveredDate.x, top: hoveredDate.y - 8 }}
        >
          <p className="text-xs font-semibold">
            {formatDiveDate(hoveredDate.date, 'medium')}
          </p>
          {hoveredDives.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No dives</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {hoveredDives.map((dive) => (
                <li key={dive.id}>
                  <Link
                    to="/dives/$diveId"
                    params={{ diveId: dive.id }}
                    className="group flex items-baseline gap-2 text-xs"
                  >
                    <span className="shrink-0 font-mono text-muted-foreground">
                      #{dive.number ?? '—'}
                    </span>
                    <span className="truncate font-medium group-hover:text-primary group-hover:underline">
                      {dive.siteName ?? 'Unknown dive site'}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatMeters(dive.maximumDepthMeters)} ·{' '}
                      {Math.round(dive.durationSeconds / 60)} min
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
