import { useState } from 'react'
import { formatDiveDate } from '@/modules/dives/format'

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

function cellTitle(date: string, diveCount: number) {
  const dives =
    diveCount === 0 ? 'No dives' : diveCount === 1 ? '1 dive' : `${diveCount} dives`
  return `${dives} · ${formatDiveDate(date, 'medium')}`
}

export function DiveHeatmap({
  years,
  divesPerDay,
}: {
  years: { year: number; diveCount: number }[]
  divesPerDay: { date: string; diveCount: number }[]
}) {
  const [selectedYear, setSelectedYear] = useState(years[0]?.year)
  const selected = years.find((entry) => entry.year === selectedYear) ?? years[0]
  if (!selected) return null

  const countByDate = new Map(divesPerDay.map((row) => [row.date, row.diveCount]))
  const maxDaily = Math.max(1, ...divesPerDay.map((row) => row.diveCount))
  const levelFor = (diveCount: number) =>
    diveCount === 0
      ? 0
      : Math.max(1, Math.ceil((diveCount / maxDaily) * (LEVEL_CLASSES.length - 1)))
  const weeks = buildYearWeeks(selected.year)

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <article className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-5">
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
                    const dayCount = countByDate.get(date) ?? 0
                    return (
                      <span
                        key={date}
                        title={cellTitle(date, dayCount)}
                        className={`size-[11px] rounded-[3px] ${LEVEL_CLASSES[levelFor(dayCount)]}`}
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
        className="flex flex-row flex-wrap gap-2 lg:w-24 lg:flex-col"
      >
        {years.map((entry) => (
          <button
            key={entry.year}
            type="button"
            aria-pressed={entry.year === selected.year}
            onClick={() => setSelectedYear(entry.year)}
            className={`min-h-9 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              entry.year === selected.year
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            {entry.year}
          </button>
        ))}
      </nav>
    </div>
  )
}
