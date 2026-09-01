import { Link } from '@tanstack/react-router'
import { ExternalLink, MapPin, Pencil, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMeters } from '@/modules/dives/format'
import type { MappedDiveSite } from '../-lib/map-sites'

export function SiteMapInspector({
  site,
  focusRequest,
  onClose,
}: {
  site: MappedDiveSite
  focusRequest: number
  onClose: () => void
}) {
  const cardRef = useRef<HTMLElement>(null)
  const location = [site.waterName, site.region, site.country].filter(Boolean).join(' · ')
  const openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(site.latitudeValue)}&mlon=${encodeURIComponent(site.longitudeValue)}#map=14/${encodeURIComponent(site.latitudeValue)}/${encodeURIComponent(site.longitudeValue)}`

  useEffect(() => {
    if (focusRequest > 0) cardRef.current?.focus({ preventScroll: true })
  }, [focusRequest])

  return (
    <article
      ref={cardRef}
      id="dive-site-map-inspector"
      tabIndex={-1}
      aria-labelledby="dive-site-map-inspector-title"
      className="divetracx-site-map-inspector absolute bottom-3 left-3 right-3 z-20 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-xl shadow-slate-950/10 outline-none backdrop-blur-md focus-visible:ring-2 focus-visible:ring-primary sm:right-auto sm:w-[22rem]"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
          <MapPin size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id="dive-site-map-inspector-title"
            className="text-lg font-semibold leading-tight text-foreground"
          >
            {site.name}
          </h3>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            {location || 'Location details available on the map'}
          </p>
        </div>
        <Button
          type="button"
          onClick={onClose}
          aria-label="Close dive spot details"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 text-muted-foreground"
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="rounded-lg px-2.5">
          {site.diveCount} {site.diveCount === 1 ? 'dive' : 'dives'}
        </Badge>
        <Badge variant="accent" className="rounded-lg px-2.5">
          Deepest {formatMeters(site.deepestMeters)}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <Link
          to="/data/$entity/$recordId"
          params={{ entity: 'sites', recordId: site.id }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-primary-foreground transition hover:opacity-90"
        >
          <Pencil size={14} aria-hidden="true" /> Edit site
        </Link>
        {site.latestDive ? (
          <Link
            to="/dives/$diveId"
            params={{ diveId: site.latestDive.id }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-foreground transition hover:bg-muted"
          >
            <ExternalLink size={14} aria-hidden="true" /> Latest dive
          </Link>
        ) : null}
        <a
          href={openStreetMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-primary transition hover:bg-accent"
        >
          <ExternalLink size={14} aria-hidden="true" /> Map details
        </a>
      </div>
    </article>
  )
}
