import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { DIVE_SITE_BASEMAP_STYLE } from './basemap-style'

function parseCoordinates(latitude: string, longitude: string) {
  if (latitude.trim() === '' || longitude.trim() === '') return null
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function CoordinatePicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: string
  longitude: string
  onChange: (latitude: string, longitude: string) => void
}) {
  const containerRef = useRef<HTMLElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<MapLibreMarker | null>(null)
  const onChangeRef = useRef(onChange)
  const coordinatesRef = useRef(parseCoordinates(latitude, longitude))
  const [failed, setFailed] = useState(false)
  onChangeRef.current = onChange
  coordinatesRef.current = parseCoordinates(latitude, longitude)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false

    void (async () => {
      try {
        const maplibregl = await import('maplibre-gl')
        if (disposed) return
        const initial = coordinatesRef.current
        const map = new maplibregl.Map({
          container,
          style: DIVE_SITE_BASEMAP_STYLE,
          center: initial ? [initial.lng, initial.lat] : [0, 20],
          zoom: initial ? 11 : 1,
          attributionControl: false,
        })
        mapRef.current = map
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          'top-right',
        )
        map.on('error', () => setFailed(true))

        const marker = new maplibregl.Marker({ draggable: true, color: '#0e7490' })
        markerRef.current = marker
        if (initial) marker.setLngLat([initial.lng, initial.lat]).addTo(map)

        const report = (lngLat: { lat: number; lng: number }) => {
          onChangeRef.current(lngLat.lat.toFixed(7), lngLat.lng.toFixed(7))
        }
        marker.on('dragend', () => report(marker.getLngLat()))
        map.on('click', (event) => {
          marker.setLngLat(event.lngLat).addTo(map)
          report(event.lngLat)
        })

        const resizeObserver = new ResizeObserver(() => map.resize())
        resizeObserver.observe(container)
        map.once('remove', () => resizeObserver.disconnect())
      } catch (error) {
        console.error('Coordinate picker map failed', error)
        if (!disposed) setFailed(true)
      }
    })()

    return () => {
      disposed = true
      markerRef.current?.remove()
      markerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Keep the pin in sync when the latitude/longitude inputs are edited by hand.
  useEffect(() => {
    const coordinates = parseCoordinates(latitude, longitude)
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    if (!coordinates) {
      marker.remove()
      return
    }
    const current = marker.getLngLat()
    if (
      Math.abs(current.lat - coordinates.lat) < 1e-7 &&
      Math.abs(current.lng - coordinates.lng) < 1e-7
    ) {
      return
    }
    marker.setLngLat([coordinates.lng, coordinates.lat]).addTo(map)
    map.easeTo({ center: [coordinates.lng, coordinates.lat] })
  }, [latitude, longitude])

  if (failed) {
    return (
      <p className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        The map could not be loaded. Enter latitude and longitude manually.
      </p>
    )
  }

  return (
    <div className="mt-4">
      <section
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-border"
        aria-label="Pick the site location on the map"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Click the map or drag the pin to set the coordinates, then save. ©{' '}
        <a
          className="underline underline-offset-2 hover:text-foreground"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap contributors
        </a>
        .
      </p>
    </div>
  )
}
