export interface DiveSiteMapRecord {
  id: string
  name: string
  country: string | null
  region: string | null
  waterName: string | null
  latitude: string | null
  longitude: string | null
  maximumDepthMeters: string | null
  altitudeMeters: number | null
  difficulty: string | null
  rating: number | null
  diveCount: number
  deepestMeters: string | null
  latestDive: {
    id: string
    number: number | null
    diveDate: string
  } | null
}

export interface MappedDiveSite extends DiveSiteMapRecord {
  latitudeValue: number
  longitudeValue: number
}

export interface DiveSiteCoordinateGroup {
  key: string
  latitude: number
  longitude: number
  sites: MappedDiveSite[]
}

export function mapSiteCoordinates(site: DiveSiteMapRecord): MappedDiveSite | null {
  const latitudeValue = Number(site.latitude)
  const longitudeValue = Number(site.longitude)
  if (
    site.latitude === null ||
    site.longitude === null ||
    !Number.isFinite(latitudeValue) ||
    !Number.isFinite(longitudeValue) ||
    latitudeValue < -90 ||
    latitudeValue > 90 ||
    longitudeValue < -180 ||
    longitudeValue > 180
  ) {
    return null
  }
  return { ...site, latitudeValue, longitudeValue }
}

export function groupSitesByCoordinates(sites: MappedDiveSite[]) {
  const groups = new Map<string, DiveSiteCoordinateGroup>()
  for (const site of sites) {
    const key = `${site.latitudeValue.toFixed(7)},${site.longitudeValue.toFixed(7)}`
    const group = groups.get(key)
    if (group) {
      group.sites.push(site)
    } else {
      groups.set(key, {
        key,
        latitude: site.latitudeValue,
        longitude: site.longitudeValue,
        sites: [site],
      })
    }
  }
  return Array.from(groups.values())
}

export function matchesSiteSearch(site: DiveSiteMapRecord, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  if (!normalizedSearch) return true
  return [site.name, site.country, site.region, site.waterName]
    .filter(Boolean)
    .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch))
}
