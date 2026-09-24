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
 *
 * Every response is validated with a Zod schema before it becomes a typed
 * record: since Garmin's shape can change without notice, an unrecognized or
 * missing identity must surface as a `GarminDiveApiError` rather than a
 * fabricated id that later collides with, or is mistaken for, a real one.
 */

import { z } from 'zod'

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

// Garmin sometimes sends numeric identifiers as strings; either form is
// accepted, but the result must be a real, finite number rather than the
// `-1` sentinel this module used to fabricate for a missing or malformed id.
const numericIdField = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: 'custom', message: 'identifier is not a finite number' })
    return z.NEVER
  }
  return parsed
})

const diveTokenResponseSchema = z.looseObject({
  access_token: z.string().min(1),
})

const gearSummaryItemSchema = z.looseObject({
  gearId: numericIdField,
  name: z.string().min(1),
})

const gearSummaryEnvelopeSchema = z.union([
  z.array(z.unknown()),
  z.looseObject({ gear: z.array(z.unknown()) }),
])

const diveSummaryItemSchema = z.looseObject({
  id: numericIdField,
})

const jsonObjectSchema = z.looseObject({})

const jsonArraySchema = z.array(z.unknown())

async function request<T>(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetchImpl(url, init)
  const body = await response.text()
  if (!response.ok) throw new GarminDiveApiError(response.status, url, body)
  // An object or array is always expected here, so an empty body — Garmin
  // returning 200 with nothing — is a malformed response, not "no data".
  if (!body) throw new GarminDiveApiError(response.status, url, 'empty response body')
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    throw new GarminDiveApiError(response.status, url, `not JSON: ${body}`)
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    throw new GarminDiveApiError(
      response.status,
      url,
      `unexpected response shape: ${result.error.issues.map((issue) => issue.message).join('; ')}`,
    )
  }
  return result.data
}

/**
 * Exchanges a Connect access token for a Dive-scoped one. The Connect token
 * is the `access_token` of the OAuth2 payload garmin-connect-2fa stores.
 */
export async function exchangeForDiveToken(
  connectAccessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GarminDiveToken> {
  const payload = await request(
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
    diveTokenResponseSchema,
  )
  const expiresIn = number(payload.expires_in)
  return {
    accessToken: payload.access_token,
    refreshToken: text(payload.refresh_token),
    scope: text(payload.scope),
    expiresAt: expiresIn === null ? null : Math.floor(Date.now() / 1_000) + expiresIn,
  }
}

export function createGarminDiveClient(
  token: GarminDiveToken,
  fetchImpl: typeof fetch = fetch,
) {
  const get = <T>(path: string, schema: z.ZodType<T>, params?: URLSearchParams) =>
    request(
      `${GARMIN_DIVE_HOSTS.diveApi}${path}${params ? `?${params}` : ''}`,
      { headers: { ...APP_HEADERS, Authorization: `bearer ${token.accessToken}` } },
      fetchImpl,
      schema,
    )
  const today = () => new Date().toISOString().slice(0, 10)

  return {
    async listGear(): Promise<GarminDiveGearSummary[]> {
      const params = new URLSearchParams([['current-user-date', today()]])
      for (const type of GARMIN_DIVE_GEAR_TYPES) params.append('gear-types', type)
      const payload = await get(
        '/diving/v1/gear/summary',
        gearSummaryEnvelopeSchema,
        params,
      )
      const items = Array.isArray(payload) ? payload : payload.gear
      // An item missing a stable id or name is dropped rather than imported
      // under a fabricated identity that could collide with, or shadow, a
      // real one.
      return items.flatMap((item) => {
        const parsed = gearSummaryItemSchema.safeParse(item)
        return parsed.success ? [mapGearSummary(parsed.data)] : []
      })
    },
    async getGear(gearId: number): Promise<GarminDiveGearDetail> {
      const raw = await get(
        `/diving/v1/gear/${gearId}`,
        gearSummaryItemSchema,
        new URLSearchParams([['current-user-date', today()]]),
      )
      return {
        ...mapGearSummary(raw),
        // The endpoint is already scoped to this id; trusting the request
        // parameter over a re-parsed response field avoids attributing the
        // detail to whatever id the payload happens to carry.
        gearId,
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
      const url = `${GARMIN_DIVE_HOSTS.diveApi}/diving/v1/dive/summary`
      const payload = await get(
        '/diving/v1/dive/summary',
        jsonObjectSchema,
        new URLSearchParams({
          requestedPage: String(page),
          resultsPerPage: String(resultsPerPage),
        }),
      )
      // The list lives under a key that has changed before, so every
      // array-valued property is a candidate — but it is only accepted once
      // every item in it validates as a dive summary, so an unrelated array
      // (diagnostics, warnings, …) is never mistaken for the dive list.
      const diveArray = Object.values(payload).find(
        (value): value is unknown[] =>
          Array.isArray(value) &&
          value.every((item) => diveSummaryItemSchema.safeParse(item).success),
      )
      if (!diveArray) {
        throw new GarminDiveApiError(
          200,
          url,
          'no array of recognizable dive summaries in the response',
        )
      }
      return {
        totalCount: number(payload.totalCount),
        dives: diveArray.map((item) => mapDiveSummary(diveSummaryItemSchema.parse(item))),
        raw: payload,
      }
    },
    async listDevices(): Promise<GarminDiveDevice[]> {
      const payload = await get('/diving/v1/dive/devices', jsonArraySchema)
      return payload.map((item) => {
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
    /**
     * The original FIT file for a dive, as recorded by the watch. It lives on
     * Connect's download service, which the Dive bearer reaches through its
     * CONNECT_READ scope; the response is a zip holding the single .fit entry.
     */
    async downloadFitArchive(connectActivityId: number | string): Promise<Uint8Array> {
      // The download service answers 406 to the JSON Accept header the other
      // endpoints want; it serves a zip.
      const response = await fetchImpl(
        `${GARMIN_DIVE_HOSTS.connectApi}/download-service/files/activity/${connectActivityId}`,
        {
          headers: {
            ...APP_HEADERS,
            Accept: '*/*',
            Authorization: `bearer ${token.accessToken}`,
          },
        },
      )
      if (!response.ok) {
        throw new GarminDiveApiError(
          response.status,
          `download-service/files/activity/${connectActivityId}`,
          await response.text(),
        )
      }
      return new Uint8Array(await response.arrayBuffer())
    },
    async listTags(): Promise<Record<string, number>> {
      const payload = await get('/diving/v1/dive/tags', jsonObjectSchema)
      return Object.fromEntries(
        Object.entries(payload).flatMap(([key, value]) => {
          const count = number(value)
          return count === null ? [] : [[key, count]]
        }),
      )
    },
  }
}

function mapGearSummary(
  raw: z.infer<typeof gearSummaryItemSchema>,
): GarminDiveGearSummary {
  const stats = object(raw.stats)
  return {
    gearId: raw.gearId,
    name: raw.name,
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

function mapDiveSummary(raw: z.infer<typeof diveSummaryItemSchema>): GarminDiveSummary {
  const entry = object(raw.entryLoc)
  const latitude = number(entry.latitude)
  const longitude = number(entry.longitude)
  return {
    id: raw.id,
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
