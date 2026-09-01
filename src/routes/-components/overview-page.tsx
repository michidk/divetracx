import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Backpack,
  CircleUserRound,
  Clock3,
  Gauge,
  MapPinned,
  Plus,
  UsersRound,
  Waves,
} from 'lucide-react'
import { diveTypeIcon } from '@/components/dive-type-icon'
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

function mediaUrl(path: string) {
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
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
    {
      label: 'Sites visited',
      value: data.summary.sitesVisited.toLocaleString(),
      detail: `${data.summary.siteCount.toLocaleString()} sites in your logbook`,
      icon: MapPinned,
    },
  ]

  const shortcuts = [
    {
      to: '/sites',
      label: 'Dive sites',
      value: data.summary.siteCount,
      icon: MapPinned,
    },
    {
      to: '/buddies',
      label: 'Buddies',
      value: data.summary.buddyCount,
      icon: UsersRound,
    },
    {
      to: '/gear',
      label: 'Gear in use',
      value: data.summary.gearCount,
      icon: Backpack,
    },
    {
      to: '/profile',
      label: 'Certifications',
      value: data.summary.certificationCount,
      icon: CircleUserRound,
    },
  ] as const

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="flex items-center gap-4">
            <Link
              to="/dives/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
            >
              <Plus size={16} aria-hidden="true" /> Log dive
            </Link>
            <Link
              to="/dives"
              className="flex items-center gap-2 text-sm font-semibold text-primary"
            >
              All dives <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {data.recentDives.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No dives yet. Log your first dive or import a logbook in Settings.
            </div>
          ) : (
            data.recentDives.map((dive, index) => {
              const TypeIcon = diveTypeIcon(dive.diveTypeName)
              return (
                <Link
                  key={dive.id}
                  to="/dives/$diveId"
                  params={{ diveId: dive.id }}
                  className={`group relative isolate flex min-h-20 items-center justify-between gap-4 overflow-hidden p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:px-6 ${index > 0 ? 'border-t border-border' : ''}`}
                >
                  {dive.picturePath ? (
                    <>
                      <img
                        src={mediaUrl(dive.picturePath)}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 -z-20 size-full scale-105 object-cover blur-[2px]"
                        loading="lazy"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 -z-10 bg-card/85 transition-colors group-hover:bg-card/70"
                      />
                    </>
                  ) : null}
                  <div className="flex min-w-0 items-center gap-4">
                    <span
                      title={dive.diveTypeName ?? undefined}
                      className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary shadow-sm"
                    >
                      <TypeIcon size={19} aria-hidden="true" />
                      <span className="sr-only">{dive.diveTypeName ?? 'Dive'}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {dive.siteName ?? 'Unknown dive site'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(dive.diveDate)} · {dive.country ?? 'Country not set'}
                        {dive.diveTypeName ? ` · ${dive.diveTypeName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold">
                      {Number(dive.maximumDepthMeters ?? 0).toFixed(1)} m
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Math.round(dive.durationSeconds / 60)} min
                    </p>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.to}
            to={shortcut.to}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
                <shortcut.icon size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{shortcut.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {shortcut.value.toLocaleString()}
                </span>
              </span>
            </span>
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </Link>
        ))}
      </section>
    </div>
  )
}
