import { describe, expect, test } from 'bun:test'
import type { GarminAdapterBatch } from '../envelope'
import type { GarminAdapterEnvironment } from './environment.server'
import { createGarminAdapterFetchHandler } from './http.server'
import type { GarminAdapterBatchSource, GarminAdapterMode } from './source.server'

const environment: GarminAdapterEnvironment = {
  GARMIN_ADAPTER_PORT: 8787,
  GARMIN_ADAPTER_AUTHORIZATION: 'Bearer adapter-secret',
  GARMIN_TOKEN_DIRECTORY: '/tmp/garmin-tokens',
  GARMIN_EMAIL: undefined,
  GARMIN_PASSWORD: undefined,
  GARMIN_DOMAIN: 'garmin.com',
  GARMIN_ACTIVITY_PAGE_SIZE: 50,
  GARMIN_FULL_IMPORT_MAX_ACTIVITIES: 2_000,
  GARMIN_INCREMENTAL_OVERLAP_SECONDS: 3_600,
}

const emptyBatch: GarminAdapterBatch = {
  activities: [],
  nextState: { lastActivityStartSeconds: 123 },
  sourceDescription: 'stub sweep',
  diagnostics: { activitiesScanned: 0 },
}

function stubSource(
  onFetch?: (mode: GarminAdapterMode, state: Record<string, unknown>) => void,
): GarminAdapterBatchSource {
  return {
    fetchBatch(mode, state) {
      onFetch?.(mode, state)
      return Promise.resolve(emptyBatch)
    },
  }
}

function importRequest(body: unknown, authorization?: string) {
  return new Request('http://adapter.internal/import', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('createGarminAdapterFetchHandler', () => {
  test('answers health checks without authorization', async () => {
    const handler = createGarminAdapterFetchHandler(stubSource(), environment)
    const response = await handler(new Request('http://adapter.internal/healthz'))
    expect(response.status).toBe(200)
  })

  test('rejects missing and wrong authorization', async () => {
    const handler = createGarminAdapterFetchHandler(stubSource(), environment)
    const unauthenticated = await handler(importRequest({ mode: 'full', state: {} }))
    expect(unauthenticated.status).toBe(401)
    const wrong = await handler(
      importRequest({ mode: 'full', state: {} }, 'Bearer other'),
    )
    expect(wrong.status).toBe(401)
  })

  test('fails closed when no shared authorization is configured', async () => {
    const handler = createGarminAdapterFetchHandler(stubSource(), {
      ...environment,
      GARMIN_ADAPTER_AUTHORIZATION: undefined,
    })
    const response = await handler(importRequest({ mode: 'full', state: {} }))
    expect(response.status).toBe(503)
  })

  test('validates the requested mode', async () => {
    const handler = createGarminAdapterFetchHandler(stubSource(), environment)
    const response = await handler(
      importRequest({ mode: 'sideways', state: {} }, 'Bearer adapter-secret'),
    )
    expect(response.status).toBe(400)
  })

  test('passes mode and opaque state through and returns the batch', async () => {
    const calls: Array<{ mode: GarminAdapterMode; state: Record<string, unknown> }> = []
    const handler = createGarminAdapterFetchHandler(
      stubSource((mode, state) => {
        calls.push({ mode, state })
      }),
      environment,
    )
    const response = await handler(
      importRequest(
        { mode: 'incremental', state: { lastActivityStartSeconds: 42 } },
        'Bearer adapter-secret',
      ),
    )
    expect(response.status).toBe(200)
    expect(calls).toEqual([
      { mode: 'incremental', state: { lastActivityStartSeconds: 42 } },
    ])
    expect(await response.json()).toEqual({
      activities: [],
      nextState: { lastActivityStartSeconds: 123 },
      sourceDescription: 'stub sweep',
      diagnostics: { activitiesScanned: 0 },
    })
  })

  test('reports source failures as HTTP 500 with the message', async () => {
    const handler = createGarminAdapterFetchHandler(
      {
        fetchBatch() {
          return Promise.reject(new Error('Garmin rate limit'))
        },
      },
      environment,
    )
    const response = await handler(
      importRequest({ mode: 'full', state: {} }, 'Bearer adapter-secret'),
    )
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Garmin rate limit' })
  })
})
