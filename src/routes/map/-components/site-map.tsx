import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { groupSitesByCoordinates, type MappedDiveSite } from '../-lib/map-sites'
import { SiteMapInspector } from './site-map-inspector'
import {
  configureSiteMapMarkerNavigation,
  createSiteMapMarkerElement,
  getVisibleSiteGroupKeys,
  syncSiteMapMarkerSelection,
} from './site-map-marker'
import { SiteMapStatus, type SiteMapStatusValue } from './site-map-status'
import { DIVE_SITE_BASEMAP_STYLE } from './site-map-style'
import { fitSiteMapGroups, positionSelectedDiveSite } from './site-map-viewport'

const MAP_LOAD_TIMEOUT_MS = 8_000

export function SiteMap({
  sites,
  selectedSiteId,
  onSelectSite,
}: {
  sites: MappedDiveSite[]
  selectedSiteId: string | null
  onSelectSite: (siteId: string | null) => void
}) {
  const groups = useMemo(() => groupSitesByCoordinates(sites), [sites])
  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null
  const containerRef = useRef<HTMLElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map())
  const markerElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map())
  const retryButtonRef = useRef<HTMLButtonElement>(null)
  const shouldFocusRetryRef = useRef(false)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const groupsRef = useRef(groups)
  const selectedSiteIdRef = useRef(selectedSiteId)
  const onSelectSiteRef = useRef(onSelectSite)
  const rovingGroupKeyRef = useRef<string | null>(null)
  const lastSelectedGroupKeyRef = useRef<string | null>(null)
  const lastPositionedSiteIdRef = useRef<string | null>(null)
  const [mapAttempt, setMapAttempt] = useState(0)
  const [status, setStatus] = useState<SiteMapStatusValue>('loading')
  const [inspectorFocusRequest, setInspectorFocusRequest] = useState(0)

  groupsRef.current = groups
  selectedSiteIdRef.current = selectedSiteId
  onSelectSiteRef.current = onSelectSite

  const selectedGroupKey =
    groups.find((group) => group.sites.some((site) => site.id === selectedSiteId))?.key ??
    null
  if (selectedGroupKey && selectedGroupKey !== lastSelectedGroupKeyRef.current) {
    rovingGroupKeyRef.current = selectedGroupKey
  }

  const handleMapError = useCallback((error: unknown) => {
    console.error('Dive site map failed', error)
    shouldFocusRetryRef.current =
      containerRef.current?.contains(document.activeElement) ?? false
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    loadTimeoutRef.current = null
    setStatus('error')
  }, [])

  const synchronizeMarkerSelection = useCallback((map: MapLibreMap) => {
    let focusedGroupKey: string | null = null
    for (const [groupKey, element] of markerElementsRef.current) {
      if (element === document.activeElement) focusedGroupKey = groupKey
    }
    const visibleGroupKeys = getVisibleSiteGroupKeys(map, groupsRef.current)
    const activeSelectedGroupKey =
      groupsRef.current.find((group) =>
        group.sites.some((site) => site.id === selectedSiteIdRef.current),
      )?.key ?? null
    const tabbableGroupKey = syncSiteMapMarkerSelection(
      markerElementsRef.current,
      activeSelectedGroupKey,
      visibleGroupKeys,
      focusedGroupKey ?? rovingGroupKeyRef.current,
    )
    rovingGroupKeyRef.current = tabbableGroupKey

    if (focusedGroupKey && !visibleGroupKeys.includes(focusedGroupKey)) {
      if (tabbableGroupKey) {
        markerElementsRef.current.get(tabbableGroupKey)?.focus()
      } else {
        map.getCanvas().focus()
      }
    }
  }, [])

  useEffect(() => {
    if (status !== 'error' || !shouldFocusRetryRef.current) return
    shouldFocusRetryRef.current = false
    retryButtonRef.current?.focus()
  }, [status])

  // mapAttempt intentionally re-runs initialization after the user requests a retry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry state is an intentional effect trigger
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false
    let failed = false

    void (async () => {
      const fail = (error: unknown) => {
        if (disposed || failed) return
        failed = true
        handleMapError(error)
      }

      try {
        const maplibregl = await import('maplibre-gl')
        if (disposed) return
        const map = new maplibregl.Map({
          container,
          style: DIVE_SITE_BASEMAP_STYLE,
          center: [0, 20],
          zoom: 2,
          attributionControl: false,
        })
        mapRef.current = map
        loadTimeoutRef.current = setTimeout(
          () => fail('Map loading timed out'),
          MAP_LOAD_TIMEOUT_MS,
        )
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          'top-right',
        )
        map.on('load', () => {
          if (disposed || failed) return
          if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
          loadTimeoutRef.current = null
          setStatus('ready')
          synchronizeMarkerSelection(map)
        })
        map.on('moveend', () => synchronizeMarkerSelection(map))
        map.on('error', (event) => fail(event.error))
        map.on('click', () => onSelectSiteRef.current(null))

        const resizeObserver = new ResizeObserver(() => map.resize())
        resizeObserver.observe(container)
        map.once('remove', () => resizeObserver.disconnect())
      } catch (error) {
        fail(error)
      }
    })()

    return () => {
      disposed = true
      for (const marker of markersRef.current.values()) marker.remove()
      markersRef.current.clear()
      markerElementsRef.current.clear()
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [handleMapError, mapAttempt, synchronizeMarkerSelection])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    const map = mapRef.current
    let disposed = false

    void (async () => {
      try {
        const maplibregl = await import('maplibre-gl')
        if (disposed) return
        let focusedGroupKey: string | null = null
        for (const [groupKey, element] of markerElementsRef.current) {
          if (element === document.activeElement) focusedGroupKey = groupKey
        }
        if (focusedGroupKey) rovingGroupKeyRef.current = focusedGroupKey

        for (const marker of markersRef.current.values()) marker.remove()
        markersRef.current.clear()
        markerElementsRef.current.clear()

        for (const group of groups) {
          const element = createSiteMapMarkerElement(
            group,
            (selectedGroup, focusInspector) => {
              const currentIndex = selectedGroup.sites.findIndex(
                (site) => site.id === selectedSiteIdRef.current,
              )
              const nextSite =
                selectedGroup.sites[(currentIndex + 1) % selectedGroup.sites.length]
              if (!nextSite) return
              onSelectSiteRef.current(nextSite.id)
              if (focusInspector) {
                setInspectorFocusRequest((request) => request + 1)
              }
            },
          )
          const marker = new maplibregl.Marker({ element, anchor: 'center' })
            .setLngLat([group.longitude, group.latitude])
            .addTo(map)
          markersRef.current.set(group.key, marker)
          markerElementsRef.current.set(group.key, element)
        }

        configureSiteMapMarkerNavigation(
          markerElementsRef.current,
          () => getVisibleSiteGroupKeys(map, groupsRef.current),
          (groupKey) => {
            rovingGroupKeyRef.current = groupKey
          },
        )
        synchronizeMarkerSelection(map)

        const activeSelectedSite = sites.find(
          (site) => site.id === selectedSiteIdRef.current,
        )
        if (activeSelectedSite) {
          lastPositionedSiteIdRef.current = activeSelectedSite.id
          positionSelectedDiveSite(map, activeSelectedSite)
        } else {
          lastPositionedSiteIdRef.current = null
          fitSiteMapGroups(map, groups)
        }

        if (focusedGroupKey) {
          const focusedMarker = markerElementsRef.current.get(focusedGroupKey)
          if (focusedMarker && !focusedMarker.hidden) focusedMarker.focus()
        }
      } catch (error) {
        if (!disposed) handleMapError(error)
      }
    })()

    return () => {
      disposed = true
    }
  }, [groups, handleMapError, sites, status, synchronizeMarkerSelection])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    const map = mapRef.current
    synchronizeMarkerSelection(map)
    if (!selectedSiteId) {
      const previousGroupKey = lastSelectedGroupKeyRef.current
      if (previousGroupKey) {
        markerElementsRef.current.get(previousGroupKey)?.focus()
      }
      lastSelectedGroupKeyRef.current = null
      lastPositionedSiteIdRef.current = null
      return
    }

    lastSelectedGroupKeyRef.current = selectedGroupKey
    if (lastPositionedSiteIdRef.current === selectedSiteId) return
    const activeSelectedSite = sites.find((site) => site.id === selectedSiteId)
    if (!activeSelectedSite) return
    lastPositionedSiteIdRef.current = selectedSiteId
    requestAnimationFrame(() => positionSelectedDiveSite(map, activeSelectedSite))
  }, [selectedGroupKey, selectedSiteId, sites, status, synchronizeMarkerSelection])

  return (
    <div className="flex h-[34rem] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative min-h-0 flex-1">
        <section
          ref={containerRef}
          className="divetracx-site-map h-full w-full"
          aria-label="Interactive map of dive spots"
          aria-hidden={status !== 'ready'}
          inert={status !== 'ready'}
        />
        {selectedSite ? (
          <SiteMapInspector
            site={selectedSite}
            focusRequest={inspectorFocusRequest}
            onClose={() => onSelectSite(null)}
          />
        ) : null}
        <SiteMapStatus
          status={status}
          retryButtonRef={retryButtonRef}
          onRetry={() => {
            setStatus('loading')
            setMapAttempt((attempt) => attempt + 1)
          }}
        />
      </div>
      <p className="border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        ©{' '}
        <a
          className="underline underline-offset-2 hover:text-foreground"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap contributors
        </a>
        {' · © '}
        <a
          className="underline underline-offset-2 hover:text-foreground"
          href="https://carto.com/attributions"
          target="_blank"
          rel="noopener noreferrer"
        >
          CARTO
        </a>
        .
      </p>
    </div>
  )
}
