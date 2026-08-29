import { Link } from '@tanstack/react-router'
import { ArrowRight, Clock3, Gauge, Waves } from 'lucide-react'
import type { getDashboard } from '@/modules/dives/server/queries'

type DashboardData = Awaited<ReturnType<typeof getDashboard>>

function formatHours(seconds: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(
    seconds / 3600,
  )
}

function formatDate(value: string | null) {
  if (!value) return 'No dives yet'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
    new Date(`${value}T00:00:00`),
  )
}

export function OverviewPage({ data }: { data: DashboardData }) {
  const metrics = [
    {
      label: 'Logged dives',
      value: data.summary.totalDives.toLocaleString(),
      detail: `Latest ${formatDate(data.summary.latestDiveDate)}`,
      icon: Waves,
    },
    {
      label: 'Bottom time',
      value: `${formatHours(data.summary.totalSeconds)} h`,
      detail: 'Across the complete logbook',
      icon: Clock3,
    },
    {
      label: 'Deepest dive',
      value: `${Number(data.summary.deepestMeters).toFixed(1)} m`,
      detail: 'Maximum recorded depth',
      icon: Gauge,
    },
  ]

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-7 shadow-2xl shadow-slate-950/5 md:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Dive log, under your control
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
            Your underwater history, surfaced.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground md:text-lg">
            Divetracx keeps a PostgreSQL dive log and can continuously import your
            existing DiveMate backup without locking your data into it.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <metric.icon className="mb-6 text-primary" size={22} aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{metric.value}</p>
            <p className="mt-3 text-xs text-muted-foreground">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Logbook
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Recent dives</h2>
          </div>
          <Link
            to="/dives"
            className="flex items-center gap-2 text-sm font-semibold text-primary"
          >
            All dives <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {data.recentDives.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No dives yet. Configure DiveMate sync to import your logbook.
            </div>
          ) : (
            data.recentDives.map((dive, index) => (
              <div
                key={dive.id}
                className={`flex items-center justify-between gap-4 p-4 md:px-6 ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <div>
                  <p className="font-semibold">{dive.siteName ?? 'Unknown dive site'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(dive.diveDate)} · {dive.country ?? 'Country not set'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">
                    {Number(dive.maximumDepthMeters ?? 0).toFixed(1)} m
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(dive.durationSeconds / 60)} min
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
