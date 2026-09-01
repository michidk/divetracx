import { describe, expect, test } from 'bun:test'
import type { GarminAdapterBatch } from '../envelope'
import type { GarminAdapterEnvironment } from './environment.server'
import { createGarminAdapterFetchHandler } from './http.server'
import type { GarminAdapterLoginManager } from './login.server'
import type { GarminAdapterBatchSource, GarminAdapterMode } from './source.server'

const environment: GarminAdapterEnvironment = {
  GARMIN_ADAPTER_PORT: 8787,
  GARMIN_ADAPTER_AUTHORIZATION: 'Bearer adapter-secret',
  GARMIN_ADAPTER_UI_PASSWORD: undefined,
  GARMIN_TOKEN_DIRECTORY: '/tmp/garmin-tokens',
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

interface StubLoginOptions {
  connected?: boolean
  loginError?: Error
}

function stubLoginManager(options: StubLoginOptions = {}) {
  const calls: Array<{ action: string; email?: string; password?: string }> = []
  const manager: GarminAdapterLoginManager = {
    status() {
      return {
        connected: options.connected ?? false,
        tokensSavedAt: options.connected ? new Date('2026-08-14T07:32:10Z') : null,
      }
    },
    login(email, password) {
      calls.push({ action: 'login', email, password })
      if (options.loginError) return Promise.reject(options.loginError)
      return Promise.resolve({ displayName: 'Diver Dan' })
    },
    logout() {
      calls.push({ action: 'logout' })
    },
  }
  return { manager, calls }
}

function handler(
  overrides: Partial<GarminAdapterEnvironment> = {},
  login: StubLoginOptions = {},
  onFetch?: (mode: GarminAdapterMode, state: Record<string, unknown>) => void,
) {
  const stub = stubLoginManager(login)
  return {
    calls: stub.calls,
    fetch: createGarminAdapterFetchHandler(
      { source: stubSource(onFetch), loginManager: stub.manager },
      { ...environment, ...overrides },
    ),
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

function loginRequest(fields: Record<string, string>, authorization?: string) {
  return new Request('http://adapter.internal/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(authorization ? { authorization } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  })
}

describe('import endpoint', () => {
  test('answers health checks without authorization', async () => {
    const response = await handler().fetch(new Request('http://adapter.internal/healthz'))
    expect(response.status).toBe(200)
  })

  test('rejects missing and wrong authorization', async () => {
    const { fetch } = handler()
    expect((await fetch(importRequest({ mode: 'full', state: {} }))).status).toBe(401)
    expect(
      (await fetch(importRequest({ mode: 'full', state: {} }, 'Bearer other'))).status,
    ).toBe(401)
  })

  test('fails closed when no shared authorization is configured', async () => {
    const { fetch } = handler({ GARMIN_ADAPTER_AUTHORIZATION: undefined })
    expect((await fetch(importRequest({ mode: 'full', state: {} }))).status).toBe(503)
  })

  test('validates the requested mode', async () => {
    const { fetch } = handler()
    const response = await fetch(
      importRequest({ mode: 'sideways', state: {} }, 'Bearer adapter-secret'),
    )
    expect(response.status).toBe(400)
  })

  test('passes mode and opaque state through and returns the batch', async () => {
    const calls: Array<{ mode: GarminAdapterMode; state: Record<string, unknown> }> = []
    const { fetch } = handler({}, {}, (mode, state) => {
      calls.push({ mode, state })
    })
    const response = await fetch(
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
    const failing = createGarminAdapterFetchHandler(
      {
        source: {
          fetchBatch() {
            return Promise.reject(new Error('Garmin rate limit'))
          },
        },
        loginManager: stubLoginManager().manager,
      },
      environment,
    )
    const response = await failing(
      importRequest({ mode: 'full', state: {} }, 'Bearer adapter-secret'),
    )
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Garmin rate limit' })
  })
})

describe('setup UI', () => {
  test('serves the setup page with the connection status', async () => {
    const disconnected = await handler().fetch(new Request('http://adapter.internal/'))
    expect(disconnected.status).toBe(200)
    expect(await disconnected.text()).toContain('Not connected')

    const connected = await handler({}, { connected: true }).fetch(
      new Request('http://adapter.internal/'),
    )
    expect(await connected.text()).toContain('Connected to Garmin Connect')
  })

  test('gates the UI behind basic auth when a password is configured', async () => {
    const { fetch } = handler({ GARMIN_ADAPTER_UI_PASSWORD: 'ui-secret' })
    const denied = await fetch(new Request('http://adapter.internal/'))
    expect(denied.status).toBe(401)
    expect(denied.headers.get('www-authenticate')).toContain('Basic')

    const allowed = await fetch(
      new Request('http://adapter.internal/', {
        headers: {
          authorization: `Basic ${Buffer.from('anyone:ui-secret').toString('base64')}`,
        },
      }),
    )
    expect(allowed.status).toBe(200)
  })

  test('logs in through the form and redirects with a success message', async () => {
    const { fetch, calls } = handler()
    const response = await fetch(
      loginRequest({ email: 'diver@example.test', password: 'secret' }),
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toContain('Logged+in+as+Diver+Dan')
    expect(calls).toEqual([
      { action: 'login', email: 'diver@example.test', password: 'secret' },
    ])
  })

  test('surfaces login failures in the redirect', async () => {
    const { fetch } = handler({}, { loginError: new Error('MFA is not supported') })
    const response = await fetch(
      loginRequest({ email: 'diver@example.test', password: 'secret' }),
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toContain('error=MFA+is+not+supported')
  })

  test('requires both form fields', async () => {
    const { fetch, calls } = handler()
    const response = await fetch(loginRequest({ email: 'diver@example.test' }))
    expect(response.headers.get('location')).toContain('error=')
    expect(calls).toEqual([])
  })

  test('logout clears tokens and redirects', async () => {
    const { fetch, calls } = handler({}, { connected: true })
    const response = await fetch(
      new Request('http://adapter.internal/logout', { method: 'POST' }),
    )
    expect(response.status).toBe(303)
    expect(calls).toEqual([{ action: 'logout' }])
  })

  test('the import endpoint ignores the UI password gate', async () => {
    const { fetch } = handler({ GARMIN_ADAPTER_UI_PASSWORD: 'ui-secret' })
    const response = await fetch(
      importRequest({ mode: 'full', state: {} }, 'Bearer adapter-secret'),
    )
    expect(response.status).toBe(200)
  })
})
