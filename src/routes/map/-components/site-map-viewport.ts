import type { Map as MapLibreMap } from 'maplibre-gl'
import type { DiveSiteCoordinateGroup, MappedDiveSite } from '../-lib/map-sites'

function animationDuration() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350
}

export function fitSiteMapGroups(
  map: MapLibreMap,
  groups: readonly DiveSiteCoordinateGroup[],
): void {
  if (groups.length === 0) {
    map.easeTo({ center: [0, 20], zoom: 2, duration: animationDuration() })
    return
  }

  const firstGroup = groups[0]
  if (!firstGroup) return
  if (groups.length === 1) {
    map.easeTo({
      center: [firstGroup.longitude, firstGroup.latitude],
      zoom: 10,
      duration: animationDuration(),
    })
    return
  }

  let west = firstGroup.longitude
  let east = firstGroup.longitude
  let south = firstGroup.latitude
  let north = firstGroup.latitude
  for (const group of groups.slice(1)) {
    west = Math.min(west, group.longitude)
    east = Math.max(east, group.longitude)
    south = Math.min(south, group.latitude)
    north = Math.max(north, group.latitude)
  }
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    {
      padding: 48,
      maxZoom: 11,
      duration: animationDuration(),
    },
  )
}

export function positionSelectedDiveSite(map: MapLibreMap, site: MappedDiveSite): void {
  map.easeTo({
    center: [site.longitudeValue, site.latitudeValue],
    zoom: Math.max(map.getZoom(), 12),
    offset: [0, -64],
    duration: animationDuration(),
  })
}
