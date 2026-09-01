import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Navigation, Star, Waves } from 'lucide-react'
import { DeleteRecordButton } from '@/components/delete-record-button'
import { DiveLinkList } from '@/components/dive-link-list'
import { EntityForm } from '@/components/entity-form'
import { PhotoManager } from '@/components/photo-manager'
import { Badge } from '@/components/ui/badge'
import { formatDiveDate, formatMeters } from '@/modules/dives/format'
import type { getSite } from '@/modules/sites/server/queries'
import { renderSiteCoordinatesExtra } from '../../-components/site-coordinates-extra'

type SiteDetail = NonNullable<Awaited<ReturnType<typeof getSite>>>

export function SitePage({ detail }: { detail: SiteDetail }) {
  const navigate = useNavigate()
  const { site, dives, pictures } = detail
  const location = [site.waterName, site.region, site.country].filter(Boolean).join(' · ')
  const deepest = dives.reduce<string | null>((max, dive) => {
    if (dive.maximumDepthMeters === null) return max
    if (max === null || Number(dive.maximumDepthMeters) > Number(max)) {
      return dive.maximumDepthMeters
    }
    return max
  }, null)
  const lastDive = dives[0]

  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/sites"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> All sites
        </Link>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {site.name}
        </h1>
        <p className="mt-3 text-muted-foreground">{location || 'Location not set'}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
            <Waves size={13} aria-hidden="true" /> {dives.length}{' '}
            {dives.length === 1 ? 'dive' : 'dives'}
          </Badge>
          <Badge variant="accent" className="rounded-lg px-2.5 py-1">
            Deepest {formatMeters(deepest)}
          </Badge>
          {lastDive ? (
            <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
              Last {formatDiveDate(lastDive.diveDate, 'medium')}
            </Badge>
          ) : null}
          {site.rating ? (
            <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
              <Star className="fill-primary text-primary" size={13} aria-hidden="true" />{' '}
              {site.rating}
            </Badge>
          ) : null}
          {site.latitude && site.longitude ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(site.latitude)}&mlon=${encodeURIComponent(site.longitude)}#map=13/${encodeURIComponent(site.latitude)}/${encodeURIComponent(site.longitude)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:underline"
            >
              <Navigation size={13} aria-hidden="true" />
              {Number(site.latitude).toFixed(5)}, {Number(site.longitude).toFixed(5)}
            </a>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <h2 className="border-b border-border px-5 py-4 font-semibold">
              Dives at this site
            </h2>
            <DiveLinkList dives={dives} emptyText="No dives logged here yet." />
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Photos</h2>
            <PhotoManager target="site" targetId={site.id} pictures={pictures} />
          </section>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Site details
          </h2>
          <EntityForm
            entity="sites"
            recordId={site.id}
            record={site}
            renderSectionExtra={renderSiteCoordinatesExtra}
          />
          <div className="mt-4">
            <DeleteRecordButton
              entity="sites"
              recordId={site.id}
              label="Delete site"
              confirmText={`Delete “${site.name}”? Its ${dives.length} logged dives stay in the logbook without a site. A future full import may restore it.`}
              onDeleted={() => navigate({ to: '/sites' })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
