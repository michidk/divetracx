import type { CircleMarker, Map as LeafletMap } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { groupSitesByCoordinates, type MappedDiveSite } from '../-lib/map-sites'

function locationLabel(site: MappedDiveSite) {
  return [site.region, site.country].filter(Boolean).join(', ') || 'Location not set'
}

function createPopup(sites: MappedDiveSite[]) {
  const popup = document.createElement('div')
  popup.className = 'min-w-52 space-y-3 py-1 font-sans'

  if (sites.length > 1) {
    const heading = document.createElement('p')
    heading.className = 'text-xs font-bold uppercase tracking-wider text-slate-500'
    heading.textContent = `${sites.length} dive spots at this location`
    popup.append(heading)
  }

  for (const site of sites) {
    const entry = document.createElement('div')
    entry.className = 'border-b border-slate-200 pb-2 last:border-0 last:pb-0'

    const title = document.createElement('a')
    title.className = 'block font-semibold text-teal-800 hover:underline'
    title.href = `/data/sites/${site.id}`
    title.textContent = site.name

    const location = document.createElement('p')
    location.className = 'mt-0.5 text-xs text-slate-500'
    location.textContent = locationLabel(site)

    const summary = document.createElement('p')
    summary.className = 'mt-1 text-xs text-slate-700'
    summary.textContent = `${site.diveCount} ${site.diveCount === 1 ? 'dive' : 'dives'}${site.deepestMeters ? ` · deepest ${Number(site.deepestMeters).toFixed(1)} m` : ''}`

    entry.append(title, location, summary)

    if (site.latestDive) {
      const latestDive = document.createElement('a')
      latestDive.className =
        'mt-1 inline-block text-xs font-medium text-teal-700 hover:underline'
      latestDive.href = `/dives/${site.latestDive.id}`
      latestDive.textContent = `Open latest dive #${site.latestDive.number ?? '—'}`
      entry.append(latestDive)
    }
    popup.append(entry)
  }

  return popup
}

export function SiteMap({
  sites,
  selectedSiteId,
  onSelectSite,
}: {
  sites: MappedDiveSite[]
  selectedSiteId: string | null
  onSelectSite: (siteId: string) => void
}) {
  const containerRef = useRef<HTMLElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef(new Map<string, CircleMarker>())
  const onSelectSiteRef = useRef(onSelectSite)
  const selectedSiteIdRef = useRef(selectedSiteId)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)
  onSelectSiteRef.current = onSelectSite
  selectedSiteIdRef.current = selectedSiteId

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let map: LeafletMap | null = null
    setReady(false)

    async function initializeMap(mapContainer: HTMLElement) {
      try {
        const L = await import('leaflet')
        if (cancelled) return

        map = L.map(mapContainer, {
          scrollWheelZoom: false,
          zoomControl: true,
        })
        mapRef.current = map
        markersRef.current.clear()

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map)

        const groups = groupSitesByCoordinates(sites)
        const bounds: Array<[number, number]> = []
        for (const group of groups) {
          const diveCount = group.sites.reduce((total, site) => total + site.diveCount, 0)
          const marker = L.circleMarker([group.latitude, group.longitude], {
            radius: Math.min(16, 7 + Math.log2(Math.max(1, diveCount + 1)) * 2),
            color: '#f8ffff',
            weight: 2,
            fillColor: '#087f8c',
            fillOpacity: 0.9,
          }).addTo(map)

          marker.bindTooltip(
            group.sites.length === 1
              ? group.sites[0]?.name || 'Dive spot'
              : `${group.sites.length} dive spots`,
            { direction: 'top', offset: [0, -6] },
          )
          marker.bindPopup(createPopup(group.sites), { maxWidth: 320 })
          marker.on('click', () => {
            const selectedSite = group.sites.some(
              (site) => site.id === selectedSiteIdRef.current,
            )
              ? selectedSiteIdRef.current
              : group.sites[0]?.id
            if (selectedSite) onSelectSiteRef.current(selectedSite)
          })

          for (const site of group.sites) markersRef.current.set(site.id, marker)
          bounds.push([group.latitude, group.longitude])
        }

        if (bounds.length === 1 && bounds[0]) {
          map.setView(bounds[0], 10)
        } else if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [32, 32], maxZoom: 11 })
        } else {
          map.setView([20, 0], 2)
        }

        requestAnimationFrame(() => map?.invalidateSize())
        setReady(true)
        setError(false)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    void initializeMap(container)
    return () => {
      cancelled = true
      markersRef.current.clear()
      mapRef.current = null
      map?.remove()
    }
  }, [sites])

  useEffect(() => {
    if (!ready) return
    for (const [siteId, marker] of markersRef.current) {
      const selected = siteId === selectedSiteId
      marker.setStyle({
        fillColor: selected ? '#ea580c' : '#087f8c',
        fillOpacity: selected ? 1 : 0.9,
        weight: selected ? 4 : 2,
      })
      if (selected) {
        marker.bringToFront()
        marker.openPopup()
        mapRef.current?.panTo(marker.getLatLng())
      }
    }
  }, [selectedSiteId, ready])

  return (
    <div className="relative isolate min-h-[34rem] overflow-hidden rounded-2xl border border-border bg-muted/40">
      <section
        ref={containerRef}
        aria-label="Interactive map of dive spots"
        aria-busy={!ready && !error}
        className="h-[34rem] w-full"
      />
      {!ready && !error ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-muted/60 text-sm text-muted-foreground">
          Loading dive map…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-muted px-6 text-center text-sm text-muted-foreground">
          The map tiles could not be loaded. Every dive spot remains available in the
          list.
        </div>
      ) : null}
    </div>
  )
}
