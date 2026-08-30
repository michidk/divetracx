import { Link } from '@tanstack/react-router'
import { ExternalLink, MapPin, Pencil, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatDiveDate, formatMeters } from '@/modules/dives/format'
import type { getDiveSiteMap } from '@/modules/dives/server/queries'
import {
  type DiveSiteMapRecord,
  mapSiteCoordinates,
  matchesSiteSearch,
} from '../-lib/map-sites'
import { SiteMap } from './site-map'

type DiveSiteMapData = Awaited<ReturnType<typeof getDiveSiteMap>>

function siteLocation(site: DiveSiteMapRecord) {
  return [site.waterName, site.region, site.country].filter(Boolean).join(' · ')
}

export function MapPage({ sites }: { sites: DiveSiteMapData }) {
  const [search, setSearch] = useState('')
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const mappedSites = useMemo(
    () => sites.flatMap((site) => mapSiteCoordinates(site) ?? []),
    [sites],
  )
  const filteredSites = useMemo(
    () => sites.filter((site) => matchesSiteSearch(site, search)),
    [search, sites],
  )
  const filteredMappedSites = useMemo(
    () => filteredSites.flatMap((site) => mapSiteCoordinates(site) ?? []),
    [filteredSites],
  )

  useEffect(() => {
    if (
      selectedSiteId &&
      !filteredMappedSites.some((site) => site.id === selectedSiteId)
    ) {
      setSelectedSiteId(null)
    }
  }, [filteredMappedSites, selectedSiteId])

  const mappedDives = mappedSites.reduce((total, site) => total + site.diveCount, 0)
  const unmappedSiteCount = sites.length - mappedSites.length

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Geography
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Dive spots</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Explore every recorded dive site. Select a marker or list entry to see its
            dives and open the underlying records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-accent px-3 py-1.5 font-semibold text-foreground">
            {mappedSites.length} mapped spots
          </span>
          <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
            {mappedDives} mapped dives
          </span>
          {unmappedSiteCount > 0 ? (
            <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-800">
              {unmappedSiteCount} need coordinates
            </span>
          ) : null}
        </div>
      </header>

      <label className="relative block max-w-xl">
        <span className="sr-only">Search dive spots</span>
        <Search
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search site, water, region, or country…"
          className="min-h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.72fr)]">
        <SiteMap
          sites={filteredMappedSites}
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
        />

        <section className="flex h-[34rem] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">All dive spots</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {filteredSites.length} of {sites.length} sites
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredSites.map((site) => {
              const mappedSite = mapSiteCoordinates(site)
              const selected = site.id === selectedSiteId
              const summary = (
                <>
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{site.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {siteLocation(site) || 'Location details not set'}
                      </span>
                    </span>
                    <span
                      className={`mt-0.5 shrink-0 rounded-full p-1.5 ${mappedSite ? 'bg-accent text-primary' : 'bg-orange-100 text-orange-700'}`}
                      title={mappedSite ? 'Mapped' : 'Coordinates needed'}
                    >
                      <MapPin size={14} aria-hidden="true" />
                      <span className="sr-only">
                        {mappedSite ? 'Mapped' : 'Coordinates needed'}
                      </span>
                    </span>
                  </span>
                  <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                    <span>
                      {site.diveCount} {site.diveCount === 1 ? 'dive' : 'dives'}
                    </span>
                    <span>Deepest {formatMeters(site.deepestMeters)}</span>
                    {site.latestDive ? (
                      <span>{formatDiveDate(site.latestDive.diveDate, 'medium')}</span>
                    ) : null}
                  </span>
                </>
              )

              return (
                <article
                  key={site.id}
                  className={`border-b border-border p-3 last:border-0 ${selected ? 'bg-accent/70' : ''}`}
                >
                  {mappedSite ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSiteId(site.id)}
                      className="w-full rounded-lg p-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {summary}
                    </button>
                  ) : (
                    <div className="p-2">{summary}</div>
                  )}
                  <div className="mt-1 flex items-center gap-3 px-2 text-xs font-semibold">
                    <Link
                      to="/data/$entity/$recordId"
                      params={{ entity: 'sites', recordId: site.id }}
                      className="inline-flex min-h-9 items-center gap-1.5 text-primary hover:underline"
                    >
                      <Pencil size={13} aria-hidden="true" /> Edit site
                    </Link>
                    {site.latestDive ? (
                      <Link
                        to="/dives/$diveId"
                        params={{ diveId: site.latestDive.id }}
                        className="inline-flex min-h-9 items-center gap-1.5 text-primary hover:underline"
                      >
                        <ExternalLink size={13} aria-hidden="true" /> Latest dive
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}
            {filteredSites.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                No dive spots match this search.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {unmappedSiteCount > 0 ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          Sites without coordinates stay visible in the list. Use{' '}
          <strong>Edit site</strong> to add latitude and longitude; they will appear on
          the map immediately.
        </p>
      ) : null}
    </div>
  )
}
