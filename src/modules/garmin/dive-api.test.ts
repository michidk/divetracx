import { describe, expect, test } from 'bun:test'
import {
  createGarminDiveClient,
  exchangeForDiveToken,
  GARMIN_DIVE_GEAR_TYPES,
  GarminDiveApiError,
} from './dive-api'

function fakeFetch(handler: (url: URL, init: RequestInit) => unknown) {
  const calls: Array<{ url: URL; init: RequestInit }> = []
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input : input.url,
    )
    calls.push({ url, init })
    const result = handler(url, init)
    if (result instanceof Response) return result
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return { fetchImpl, calls }
}

describe('Garmin Dive API client', () => {
  test('exchanges the Connect bearer for a Dive-scoped token the way the app does', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({
      access_token: 'dive-access',
      refresh_token: 'dive-refresh',
      scope: 'DIVE_API_READ CONNECT_READ',
      expires_in: 3600,
    }))
    const token = await exchangeForDiveToken('connect-access', fetchImpl)

    expect(token.accessToken).toBe('dive-access')
    expect(token.refreshToken).toBe('dive-refresh')
    expect(token.scope).toBe('DIVE_API_READ CONNECT_READ')
    expect(token.expiresAt).toBeGreaterThan(Date.now() / 1_000 + 3_000)

    const [call] = calls
    expect(call?.url.toString()).toBe(
      'https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0',
    )
    expect(call?.init.method).toBe('POST')
    expect(call?.init.body).toBe('audience=DIVE_MOBILE_IOS_DI')
    const headers = call?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('bearer connect-access')
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(headers['User-Agent']).toContain('com.garmin.Dive')
  })

  test('asks for every gear type and maps summaries and details', async () => {
    const { fetchImpl, calls } = fakeFetch((url) => {
      if (url.pathname === '/diving/v1/gear/summary') {
        return [
          { gearId: 1, name: 'Deep Diver', type: 'CERTIFICATION', status: 'ACTIVE' },
          {
            gearId: 2,
            name: 'B2',
            type: 'REGULATOR',
            status: 'ACTIVE',
            dateOfFirstUse: '2023-01-01',
            stats: { numAssociatedDives: 31, totalAssociatedDiveTime: 95690.84 },
          },
        ]
      }
      if (url.pathname === '/diving/v1/gear/2') {
        return {
          gearId: 2,
          name: 'B2',
          type: 'REGULATOR',
          brand: 'Atomic Aquatics',
          model: 'B2',
          serialNumber: 12345,
          purchasePrice: 872.4,
          purchaseCurrency: 'GBP',
          purchasedFrom: 'Test Dive Shop',
          purchaseDate: '2022-12-01',
          lastServiceDate: '2025-01-01',
          nextServiceDate: '2027-01-01',
          serviceIntervalDays: 730,
          surfaceWeight: 1.1,
          surfaceWeightUnit: 'KILOGRAM',
        }
      }
      return new Response('not found', { status: 404 })
    })
    const client = createGarminDiveClient(
      { accessToken: 'dive', refreshToken: null, scope: null, expiresAt: null },
      fetchImpl,
    )

    const gear = await client.listGear()
    expect(gear.map((item) => `${item.type}:${item.name}`)).toEqual([
      'CERTIFICATION:Deep Diver',
      'REGULATOR:B2',
    ])
    expect(gear[1]?.stats?.numAssociatedDives).toBe(31)
    const summaryCall = calls[0]
    expect(summaryCall?.url.host).toBe('gcs.garmin.com')
    expect(summaryCall?.url.searchParams.getAll('gear-types')).toEqual([
      ...GARMIN_DIVE_GEAR_TYPES,
    ])
    expect(summaryCall?.url.searchParams.get('current-user-date')).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
    const summaryHeaders = (summaryCall?.init.headers ?? {}) as Record<string, string>
    expect(summaryHeaders.Authorization).toBe('bearer dive')

    const detail = await client.getGear(2)
    expect(detail).toMatchObject({
      brand: 'Atomic Aquatics',
      model: 'B2',
      serialNumber: '12345',
      purchasePrice: 872.4,
      purchasedFrom: 'Test Dive Shop',
      nextServiceDate: '2027-01-01',
      serviceIntervalDays: 730,
      surfaceWeightKg: 1.1,
    })
  })

  test('maps the dive summary page and surfaces HTTP failures', async () => {
    const { fetchImpl } = fakeFetch((url) => {
      if (url.pathname === '/diving/v1/dive/summary') {
        expect(url.searchParams.get('requestedPage')).toBe('0')
        expect(url.searchParams.get('resultsPerPage')).toBe('100')
        return {
          totalCount: 1,
          diveActivities: [
            {
              id: 10,
              connectActivityId: 99,
              name: 'Blue Hole',
              diveType: 'SINGLE_GAS',
              number: 68,
              startTime: '2025-06-15T10:00:00+00:00',
              maxDepth: 26.373,
              diveTags: ['RECREATIONAL', 'WARM_WATER'],
              activitySource: 'GARMIN_DEVICE',
              entryLoc: { latitude: 1.5, longitude: 2.5 },
              gases: [{ gasType: 'AIR', percentOxygen: 21 }],
            },
          ],
        }
      }
      return new Response('{"error":"forbidden"}', { status: 403 })
    })
    const client = createGarminDiveClient(
      { accessToken: 'dive', refreshToken: null, scope: null, expiresAt: null },
      fetchImpl,
    )

    const page = await client.listDives()
    expect(page.totalCount).toBe(1)
    expect(page.dives[0]).toMatchObject({
      id: 10,
      connectActivityId: 99,
      name: 'Blue Hole',
      number: 68,
      diveTags: ['RECREATIONAL', 'WARM_WATER'],
      entryLoc: { latitude: 1.5, longitude: 2.5 },
    })

    await expect(client.listDevices()).rejects.toBeInstanceOf(GarminDiveApiError)
    await expect(client.listDevices()).rejects.toMatchObject({ status: 403 })
  })
})
