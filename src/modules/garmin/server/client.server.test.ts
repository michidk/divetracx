import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createGarminSourceClient } from './client.server'

const originalFetch = globalThis.fetch
const originalEnvironment = {
  databaseUrl: process.env.DATABASE_URL,
  full: process.env.GARMIN_ADAPTER_FULL_IMPORT_URL,
  incremental: process.env.GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL,
  authorization: process.env.GARMIN_ADAPTER_AUTHORIZATION,
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/divetracx_test'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  restoreEnvironment('DATABASE_URL', originalEnvironment.databaseUrl)
  restoreEnvironment('GARMIN_ADAPTER_FULL_IMPORT_URL', originalEnvironment.full)
  restoreEnvironment(
    'GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL',
    originalEnvironment.incremental,
  )
  restoreEnvironment('GARMIN_ADAPTER_AUTHORIZATION', originalEnvironment.authorization)
})

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

describe('Garmin approved transport adapter', () => {
  test('passes opaque state through without inventing a timestamp cursor', async () => {
    process.env.GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL =
      'https://adapter.example.test/incremental'
    process.env.GARMIN_ADAPTER_AUTHORIZATION = 'Adapter secret'
    const requests: Request[] = []
    globalThis.fetch = (async (input, init) => {
      requests.push(new Request(input, init))
      return Response.json({
        activities: [
          {
            activityDetails: {
              ActivityId: 123,
              Summary: { ActivityType: 'diving', StartTimeInSeconds: 1_700_000_000 },
            },
          },
        ],
        nextState: { partnerContinuation: 'opaque-next' },
      })
    }) as typeof fetch

    const result = await createGarminSourceClient().fetchIncremental({
      partnerContinuation: 'opaque-current',
    })
    const request = requests[0]
    if (!request) {
      throw new Error('Expected Garmin adapter request to be captured')
    }

    const sent = (await request.json()) as Record<string, unknown>

    expect(sent).toEqual({
      mode: 'incremental',
      state: { partnerContinuation: 'opaque-current' },
    })
    expect(request.headers.get('authorization')).toBe('Adapter secret')
    expect(result.nextState).toEqual({ partnerContinuation: 'opaque-next' })
    expect(result.activities[0]?.activityDetails.ActivityId).toBe(123)
  })

  test('fails closed when no approved endpoint is configured', async () => {
    delete process.env.GARMIN_ADAPTER_FULL_IMPORT_URL
    await expect(createGarminSourceClient().fetchFull({})).rejects.toThrow(
      'approved Garmin Activity API adapter URL',
    )
  })
})
