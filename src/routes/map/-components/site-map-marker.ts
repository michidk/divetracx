import type { Map as MapLibreMap } from 'maplibre-gl'
import type { DiveSiteCoordinateGroup } from '../-lib/map-sites'

function groupLocation(group: DiveSiteCoordinateGroup) {
  const site = group.sites[0]
  if (!site) return null
  return [site.region, site.country].filter(Boolean).join(', ') || null
}

export function getVisibleSiteGroupKeys(
  map: MapLibreMap,
  groups: readonly DiveSiteCoordinateGroup[],
): readonly string[] {
  const bounds = map.getBounds()
  return groups
    .filter((group) => bounds.contains([group.longitude, group.latitude]))
    .map((group) => group.key)
}

export function createSiteMapMarkerElement(
  group: DiveSiteCoordinateGroup,
  onSelect: (group: DiveSiteCoordinateGroup, focusInspector: boolean) => void,
): HTMLButtonElement {
  const diveCount = group.sites.reduce((total, site) => total + site.diveCount, 0)
  const location = groupLocation(group)
  const marker = document.createElement('button')
  marker.type = 'button'
  marker.className = 'divetracx-site-map-marker'
  marker.tabIndex = -1
  marker.dataset.selected = 'false'
  marker.setAttribute('aria-pressed', 'false')
  marker.setAttribute(
    'aria-label',
    group.sites.length === 1
      ? `Dive spot: ${group.sites[0]?.name ?? 'Unnamed'}${location ? `, ${location}` : ''}, ${diveCount} ${diveCount === 1 ? 'dive' : 'dives'}`
      : `${group.sites.length} dive spots at this location, ${diveCount} dives`,
  )

  const pin = document.createElement('span')
  pin.className = 'divetracx-site-map-marker-pin'
  pin.setAttribute('aria-hidden', 'true')
  if (group.sites.length > 1) {
    pin.classList.add('divetracx-site-map-marker-cluster')
    pin.textContent = String(group.sites.length)
  }
  marker.append(pin)

  marker.addEventListener('click', (event) => {
    event.stopPropagation()
    onSelect(group, event.detail === 0)
  })
  return marker
}

export function configureSiteMapMarkerNavigation(
  markerElements: ReadonlyMap<string, HTMLButtonElement>,
  getNavigableGroupKeys: () => readonly string[],
  onRovingGroupChange: (groupKey: string) => void,
): void {
  for (const marker of markerElements.values()) {
    marker.addEventListener('keydown', (event) => {
      const direction =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0
      if (direction === 0) return
      event.preventDefault()
      event.stopPropagation()

      const entries: [string, HTMLButtonElement][] = []
      for (const groupKey of getNavigableGroupKeys()) {
        const element = markerElements.get(groupKey)
        if (element) entries.push([groupKey, element])
      }
      const index = entries.findIndex(([, element]) => element === marker)
      if (index < 0 || entries.length === 0) return
      const nextEntry = entries[(index + direction + entries.length) % entries.length]
      if (!nextEntry) return

      for (const [, element] of entries) element.tabIndex = -1
      const [nextGroupKey, nextMarker] = nextEntry
      nextMarker.tabIndex = 0
      nextMarker.focus()
      onRovingGroupChange(nextGroupKey)
    })
  }
}

export function syncSiteMapMarkerSelection(
  markerElements: ReadonlyMap<string, HTMLButtonElement>,
  selectedGroupKey: string | null,
  visibleGroupKeys: readonly string[],
  preferredTabbableGroupKey: string | null,
): string | null {
  const visibleGroupKeySet = new Set(visibleGroupKeys)
  const preferredMarker = preferredTabbableGroupKey
    ? visibleGroupKeySet.has(preferredTabbableGroupKey)
      ? markerElements.get(preferredTabbableGroupKey)
      : undefined
    : undefined
  const selectedMarker = selectedGroupKey
    ? visibleGroupKeySet.has(selectedGroupKey)
      ? markerElements.get(selectedGroupKey)
      : undefined
    : undefined
  const firstVisibleGroupKey = visibleGroupKeys[0]
  const tabbableMarker =
    preferredMarker ??
    selectedMarker ??
    (firstVisibleGroupKey ? markerElements.get(firstVisibleGroupKey) : undefined)

  for (const [groupKey, marker] of markerElements) {
    const isSelected = groupKey === selectedGroupKey
    marker.hidden = !visibleGroupKeySet.has(groupKey)
    marker.dataset.selected = String(isSelected)
    marker.setAttribute('aria-pressed', String(isSelected))
    marker.tabIndex = marker === tabbableMarker ? 0 : -1
    if (isSelected) marker.setAttribute('aria-controls', 'dive-site-map-inspector')
    else marker.removeAttribute('aria-controls')
  }

  return (
    visibleGroupKeys.find(
      (groupKey) => markerElements.get(groupKey) === tabbableMarker,
    ) ?? null
  )
}
