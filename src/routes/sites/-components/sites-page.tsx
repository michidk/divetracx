import { Link } from '@tanstack/react-router'
import { ChevronRight, MapPinned, Plus, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatDiveDate, formatMeters } from '@/modules/dives/format'
import type { getSites } from '@/modules/sites/server/queries'

type SitesData = Awaited<ReturnType<typeof getSites>>

function siteLocation(site: SitesData[number]) {
  return [site.waterName, site.region, site.country].filter(Boolean).join(' · ')
}

function matchesSearch(site: SitesData[number], search: string) {
  const query = search.trim().toLowerCase()
  if (!query) return true
  return [site.name, site.waterName, site.region, site.country].some((value) =>
    value?.toLowerCase().includes(query),
  )
}

export function SitesPage({ sites }: { sites: SitesData }) {
  const [search, setSearch] = useState('')
  const filteredSites = useMemo(
    () => sites.filter((site) => matchesSearch(site, search)),
    [sites, search],
  )

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Places
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Dive sites</h1>
          <p className="mt-3 text-muted-foreground">
            {sites.length} places you have dived or plan to dive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/map"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-muted"
          >
            <MapPinned size={16} aria-hidden="true" /> Map view
          </Link>
          <Link
            to="/sites/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Plus size={16} aria-hidden="true" /> Add site
          </Link>
        </div>
      </header>

      <label htmlFor="sites-search" className="relative block max-w-xl">
        <span className="sr-only">Search dive sites</span>
        <Search
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="sites-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search site, water, region, or country…"
          className="min-h-12 bg-card pl-11 pr-4 shadow-sm"
        />
      </label>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="hidden grid-cols-[minmax(14rem,1fr)_6rem_8rem_10rem_6rem_2rem] border-b border-border bg-muted/50 px-5 py-4 text-xs uppercase tracking-wider text-muted-foreground md:grid">
          <span>Site</span>
          <span className="text-right">Dives</span>
          <span className="text-right">Deepest</span>
          <span className="text-right">Last dive</span>
          <span className="text-right">Rating</span>
          <span />
        </div>
        {filteredSites.map((site) => (
          <Link
            key={site.id}
            to="/sites/$siteId"
            params={{ siteId: site.id }}
            className="group grid min-h-20 grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:grid-cols-[minmax(14rem,1fr)_6rem_8rem_10rem_6rem_2rem]"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">
                <span className="truncate">{site.name}</span>
                {!site.latitude || !site.longitude ? (
                  <span
                    className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-orange-700"
                    title="No coordinates yet"
                  >
                    No pin
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {siteLocation(site) || 'Location not set'}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground md:hidden">
                {site.diveCount} {site.diveCount === 1 ? 'dive' : 'dives'}
                {site.lastDiveDate
                  ? ` · last ${formatDiveDate(site.lastDiveDate, 'medium')}`
                  : ''}
              </span>
            </span>
            <span className="hidden text-right font-mono text-sm md:block">
              {site.diveCount}
            </span>
            <span className="hidden text-right font-mono text-sm md:block">
              {formatMeters(site.deepestMeters)}
            </span>
            <span className="hidden text-right text-sm md:block">
              {site.lastDiveDate ? formatDiveDate(site.lastDiveDate, 'medium') : '—'}
            </span>
            <span className="hidden items-center justify-end gap-1 text-sm md:flex">
              {site.rating ? (
                <>
                  <Star
                    className="fill-primary text-primary"
                    size={14}
                    aria-hidden="true"
                  />
                  {site.rating}
                </>
              ) : (
                '—'
              )}
            </span>
            <ChevronRight
              className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              size={18}
              aria-hidden="true"
            />
          </Link>
        ))}
        {filteredSites.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {sites.length === 0 ? 'No dive sites yet.' : 'No sites match this search.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
