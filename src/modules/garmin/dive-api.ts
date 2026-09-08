/**
 * Client for the undocumented Garmin Dive API that backs the Garmin Dive mobile
 * app: gear, certifications, dive metadata, and devices that never reach the
 * FIT file. The endpoints were reverse-engineered by others from captured app
 * traffic (see robemmerson/ha-garmin-dive and se0wtf/go-garminconnect), so
 * Garmin may change them at any time; callers treat failures as non-fatal.
 *
 * A Connect OAuth2 access token — the one the FIT sync already holds — is
 * exchanged for a bearer scoped to the Dive audience, which the
 * `gcs.garmin.com/diving/v1` endpoints accept.
 */

export const GARMIN_DIVE_HOSTS = {
  connectApi: 'https://connectapi.garmin.com',
  diveApi: 'https://gcs.garmin.com',
  diauth: 'https://diauth.garmin.com',
} as const

const DIVE_AUDIENCE = 'DIVE_MOBILE_IOS_DI'
const APP_HEADERS = {
  'User-Agent': 'Dive/3.4 (com.garmin.Dive; build:1; iOS 26.4.2) Alamofire/5.9.1',
  'X-App-Ver': '3.4',
  'X-Lang': 'en',
  Accept: 'application/json',
}

export const GARMIN_DIVE_GEAR_TYPES = [
  'BCD',
  'BOOTS',
  'BUOY',
  'CAMERA',
  'CERTIFICATION',
  'CUTTING_TOOL',
  'DIVE_COMPUTER',
  'EXPOSURE_SUIT',
  'FIN',
  'GLOVE',
  'HOOD',
  'LIGHT',
  'MASK',
  'REBREATHER',
  'REGULATOR',
  'SCOOTER',
  'SLATE',
  'SNORKEL',
  'SPEAR',
  'SPOOL',
  'TANK',
  'TRANSMITTER',
  'UNDERGARMENT',
  'WEIGHT',
  'OTHER',
] as const

export interface GarminDiveToken {
  accessToken: string
  refreshToken: string | null
  scope: string | null
  expiresAt: number | null
}

export interface GarminDiveGearSummary {
  gearId: number
  name: string
  type: string
  status: string | null
  dateOfFirstUse: string | null
  stats: { numAssociatedDives?: number; totalAssociatedDiveTime?: number } | null
  raw: Record<string, unknown>
}

export interface GarminDiveGearDetail extends GarminDiveGearSummary {
  brand: string | null
  model: string | null
  serialNumber: string | null
  purchaseDate: string | null
  purchasePrice: number | null
  purchaseCurrency: string | null
  purchasedFrom: string | null
  lastServiceDate: string | null
  nextServiceDate: string | null
  serviceIntervalDays: number | null
  surfaceWeightKg: number | null
}

export interface GarminDiveSummary {
  id: number
  connectActivityId: number | null
  name: string | null
  diveType: string | null
  number: number | null
  startTime: string | null
  timezone: string | null
  totalTime: number | null
  maxDepth: number | null
  bottomTime: number | null
  surfaceInterval: number | null
  diveTags: string[]
  activitySource: string | null
  entryLoc: { latitude: number; longitude: number } | null
  gases: Array<Record<string, unknown>>
  raw: Record<string, unknown>
}

export interface GarminDiveDevice {
  productDisplayName: string | null
  type: string | null
  serialNumber: string | null
  partNumber: string | null
  raw: Record<string, unknown>
}

export class GarminDiveApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string,
  ) {
    super(`Garmin Dive API ${status} for ${url}: ${body.slice(0, 300)}`)
    this.name = 'GarminDiveApiError'
  }
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function number(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value)
  return null
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function request<T>(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<T> {
  const response = await fetchImpl(url, init)
  const body = await response.text()
  if (!response.ok) throw new GarminDiveApiError(response.status, url, body)
  if (!body) return null as T
  try {
    return JSON.parse(body) as T
  } catch {
    throw new GarminDiveApiError(response.status, url, `not JSON: ${body}`)
  }
}

/**
 * Exchanges a Connect access token for a Dive-scoped one. The Connect token
 * is the `access_token` of the OAuth2 payload garmin-connect-2fa stores.
 */
export async function exchangeForDiveToken(
  connectAccessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GarminDiveToken> {
  const payload = await request<Record<string, unknown>>(
    `${GARMIN_DIVE_HOSTS.connectApi}/oauth-service/oauth/exchange/user/2.0`,
    {
      method: 'POST',
      headers: {
        ...APP_HEADERS,
        Authorization: `bearer ${connectAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ audience: DIVE_AUDIENCE }).toString(),
    },
    fetchImpl,
  )
  const accessToken = text(payload.access_token)
  if (!accessToken) throw new Error('Garmin Dive token exchange returned no access token')
  const expiresIn = number(payload.expires_in)
  return {
    accessToken,
    refreshToken: text(payload.refresh_token),
    scope: text(payload.scope),
    expiresAt: expiresIn === null ? null : Math.floor(Date.now() / 1_000) + expiresIn,
  }
}

export function createGarminDiveClient(
  token: GarminDiveToken,
  fetchImpl: typeof fetch = fetch,
) {
  const get = <T>(path: string, params?: URLSearchParams) =>
    request<T>(
      `${GARMIN_DIVE_HOSTS.diveApi}${path}${params ? `?${params}` : ''}`,
      { headers: { ...APP_HEADERS, Authorization: `bearer ${token.accessToken}` } },
      fetchImpl,
    )
  const today = () => new Date().toISOString().slice(0, 10)

  return {
    async listGear(): Promise<GarminDiveGearSummary[]> {
      const params = new URLSearchParams([['current-user-date', today()]])
      for (const type of GARMIN_DIVE_GEAR_TYPES) params.append('gear-types', type)
      const payload = await get<unknown>('/diving/v1/gear/summary', params)
      const items = Array.isArray(payload) ? payload : object(payload).gear
      return (Array.isArray(items) ? items : []).map((item) =>
        mapGearSummary(object(item)),
      )
    },
    async getGear(gearId: number): Promise<GarminDiveGearDetail> {
      const payload = await get<unknown>(
        `/diving/v1/gear/${gearId}`,
        new URLSearchParams([['current-user-date', today()]]),
      )
      const raw = object(payload)
      return {
        ...mapGearSummary(raw),
        brand: text(raw.brand),
        model: text(raw.model),
        serialNumber: raw.serialNumber === undefined ? null : String(raw.serialNumber),
        purchaseDate: text(raw.purchaseDate),
        purchasePrice: number(raw.purchasePrice),
        purchaseCurrency: text(raw.purchaseCurrency),
        purchasedFrom: text(raw.purchasedFrom),
        lastServiceDate: text(raw.lastServiceDate),
        nextServiceDate: text(raw.nextServiceDate),
        serviceIntervalDays: number(raw.serviceIntervalDays),
        surfaceWeightKg:
          raw.surfaceWeightUnit === 'KILOGRAM' || raw.surfaceWeightUnit === undefined
            ? number(raw.surfaceWeight)
            : null,
      }
    },
    async listDives(page = 0, resultsPerPage = 100) {
      const payload = object(
        await get<unknown>(
          '/diving/v1/dive/summary',
          new URLSearchParams({
            requestedPage: String(page),
            resultsPerPage: String(resultsPerPage),
          }),
        ),
      )
      const list = Object.values(payload).find(Array.isArray) as unknown[] | undefined
      return {
        totalCount: number(payload.totalCount),
        dives: (list ?? []).map((item) => mapDiveSummary(object(item))),
        raw: payload,
      }
    },
    async listDevices(): Promise<GarminDiveDevice[]> {
      const payload = await get<unknown>('/diving/v1/dive/devices')
      return (Array.isArray(payload) ? payload : []).map((item) => {
        const raw = object(item)
        return {
          productDisplayName: text(raw.productDisplayName),
          type: text(raw.type),
          serialNumber: raw.serialNumber === undefined ? null : String(raw.serialNumber),
          partNumber: text(raw.partNumber),
          raw,
        }
      })
    },
    async listTags(): Promise<Record<string, number>> {
      const payload = object(await get<unknown>('/diving/v1/dive/tags'))
      return Object.fromEntries(
        Object.entries(payload).flatMap(([key, value]) => {
          const count = number(value)
          return count === null ? [] : [[key, count]]
        }),
      )
    },
  }
}

function mapGearSummary(raw: Record<string, unknown>): GarminDiveGearSummary {
  const stats = object(raw.stats)
  return {
    gearId: number(raw.gearId) ?? -1,
    name: text(raw.name) ?? '',
    type: text(raw.type) ?? 'OTHER',
    status: text(raw.status),
    dateOfFirstUse: text(raw.dateOfFirstUse),
    stats:
      Object.keys(stats).length > 0
        ? {
            numAssociatedDives: number(stats.numAssociatedDives) ?? undefined,
            totalAssociatedDiveTime: number(stats.totalAssociatedDiveTime) ?? undefined,
          }
        : null,
    raw,
  }
}

function mapDiveSummary(raw: Record<string, unknown>): GarminDiveSummary {
  const entry = object(raw.entryLoc)
  const latitude = number(entry.latitude)
  const longitude = number(entry.longitude)
  return {
    id: number(raw.id) ?? -1,
    connectActivityId: number(raw.connectActivityId),
    name: text(raw.name),
    diveType: text(raw.diveType),
    number: number(raw.number),
    startTime: text(raw.startTime),
    timezone: text(raw.timezone),
    totalTime: number(raw.totalTime),
    maxDepth: number(raw.maxDepth),
    bottomTime: number(raw.bottomTime),
    surfaceInterval: number(raw.surfaceInterval),
    diveTags: Array.isArray(raw.diveTags)
      ? raw.diveTags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    activitySource: text(raw.activitySource),
    entryLoc: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    gases: Array.isArray(raw.gases) ? raw.gases.map(object) : [],
    raw,
  }
}
