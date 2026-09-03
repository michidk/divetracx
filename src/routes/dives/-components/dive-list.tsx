import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { diveTypeIcon } from '@/components/dive-type-icon'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  formatDiveDate,
  formatDuration,
  formatMeters,
  formatTemperature,
} from '@/modules/dives/format'
import type { getDives } from '@/modules/dives/server/queries'

type DiveListData = Awaited<ReturnType<typeof getDives>>

function mediaUrl(path: string) {
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function DiveList({ list, search }: { list: DiveListData; search: string }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(search)

  // Debounce typing into the URL so the server search runs per pause, not per key.
  useEffect(() => {
    if (query === search) return
    const handle = setTimeout(() => {
      void navigate({
        to: '/dives',
        search: { q: query || undefined },
        replace: true,
      })
    }, 350)
    return () => clearTimeout(handle)
  }, [query, search, navigate])

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Logbook
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Dives</h1>
          <p className="mt-3 text-muted-foreground">
            {search
              ? `${list.total.toLocaleString()} ${list.total === 1 ? 'dive matches' : 'dives match'} “${search}”.`
              : `${list.total.toLocaleString()} recorded dives.`}
          </p>
        </div>
        <Link
          to="/dives/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Plus size={16} aria-hidden="true" /> Log dive
        </Link>
      </header>

      <label htmlFor="dive-search" className="relative block max-w-xl">
        <span className="sr-only">Search dives</span>
        <Search
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="dive-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by site, country, dive number, or date…"
          className="min-h-12 bg-card pl-11 pr-4 shadow-sm"
        />
      </label>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="hidden grid-cols-[3.5rem_5rem_minmax(12rem,1fr)_10rem_7rem_7rem_7rem_2rem] border-b border-border bg-muted/50 px-5 py-4 text-xs uppercase tracking-wider text-muted-foreground md:grid">
          <span>Type</span>
          <span>Dive</span>
          <span>Site</span>
          <span>Date</span>
          <span className="text-right">Time</span>
          <span className="text-right">Depth</span>
          <span className="text-right">Water</span>
          <span />
        </div>
        {list.records.map((dive) => {
          const TypeIcon = diveTypeIcon(dive.diveTypeName)
          return (
            <Link
              key={dive.id}
              to="/dives/$diveId"
              params={{ diveId: dive.id }}
              className="group relative isolate grid min-h-20 grid-cols-[3rem_minmax(0,1fr)_auto_1.25rem] items-center gap-4 overflow-hidden border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:grid-cols-[3.5rem_5rem_minmax(12rem,1fr)_10rem_7rem_7rem_7rem_2rem]"
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
              <span
                title={dive.diveTypeName ?? undefined}
                className="grid size-11 place-items-center rounded-xl bg-accent text-primary shadow-sm"
              >
                <TypeIcon size={19} aria-hidden="true" />
                <span className="sr-only">{dive.diveTypeName ?? 'Dive'}</span>
              </span>
              <span className="hidden font-mono text-sm text-muted-foreground md:block">
                #{dive.number ?? '—'}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {dive.siteName ?? 'Unknown site'}
                </span>
                <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    <span className="md:hidden">
                      #{dive.number ?? '—'} · {formatDiveDate(dive.diveDate, 'medium')}
                    </span>
                    <span className="hidden md:inline">
                      {dive.country ?? 'Country not set'}
                    </span>
                  </span>
                  {dive.diveTypeName ? (
                    <Badge
                      variant="secondary"
                      className="max-w-full truncate px-2 py-0.5 text-[0.6875rem] leading-4"
                    >
                      {dive.diveTypeName}
                    </Badge>
                  ) : null}
                  {dive.decompressionDive ? (
                    <Badge
                      variant="destructive"
                      className="px-2 py-0.5 text-[0.6875rem] font-bold leading-4 tracking-wide"
                    >
                      DECO
                    </Badge>
                  ) : null}
                </span>
              </span>
              <span className="hidden text-sm md:block">
                {formatDiveDate(dive.diveDate, 'medium')}
              </span>
              <span className="hidden text-right font-mono text-sm md:block">
                {formatDuration(dive.durationSeconds)}
              </span>
              <span className="text-right font-mono text-sm">
                <span className="block">{formatMeters(dive.maximumDepthMeters)}</span>
                <span className="mt-1 block text-xs text-muted-foreground md:hidden">
                  {formatDuration(dive.durationSeconds)}
                </span>
              </span>
              <span className="hidden text-right font-mono text-sm md:block">
                {formatTemperature(dive.waterTemperatureCelsius)}
              </span>
              <ChevronRight
                className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                size={18}
                aria-hidden="true"
              />
            </Link>
          )
        })}
        {list.records.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {search
              ? 'No dives match this search.'
              : 'No dives yet. Log your first dive or import a logbook in Settings.'}
          </p>
        ) : null}
      </div>

      {list.pageCount > 1 ? (
        <nav aria-label="Dive pages" className="flex items-center justify-between gap-4">
          {list.page > 1 ? (
            <Link
              to="/dives"
              search={{ q: search || undefined, page: list.page - 1 }}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-muted"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted-foreground">
            Page {list.page.toLocaleString()} of {list.pageCount.toLocaleString()}
          </p>
          {list.page < list.pageCount ? (
            <Link
              to="/dives"
              search={{ q: search || undefined, page: list.page + 1 }}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-muted"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  )
}
