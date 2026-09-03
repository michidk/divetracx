import { describe, expect, test } from 'bun:test'
import type { GarminAdapterBatch } from '../envelope'
import type { GarminAdapterEnvironment } from './environment.server'
import { createGarminAdapterFetchHandler } from './http.server'
import type { GarminAdapterLoginManager } from './login.server'
import type { GarminAdapterBatchSource, GarminAdapterMode } from './source.server'

const environment: GarminAdapterEnvironment = {
  GARMIN_ADAPTER_PORT: 8787,
  GARMIN_ADAPTER_AUTHORIZATION: 'Bearer adapter-secret',
  GARMIN_TOKEN_DIRECTORY: '/tmp/garmin-tokens',
  GARMIN_DOMAIN: 'garmin.com',
  GARMIN_ACTIVITY_PAGE_SIZE: 50,
  GARMIN_FULL_IMPORT_MAX_ACTIVITIES: 2_000,
  GARMIN_INCREMENTAL_OVERLAP_SECONDS: 3_600,
  GARMIN_MFA_CHALLENGE_TTL_SECONDS: 300,
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
  mfaRequired?: boolean
  loginError?: Error
  mfaError?: Error
}

function stubLoginManager(options: StubLoginOptions = {}) {
  const calls: Array<{
    action: string
    email?: string
    password?: string
    challengeId?: string
    code?: string
  }> = []
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
      if (options.mfaRequired) {
        return Promise.resolve({
          status: 'mfa-required' as const,
          challengeId: 'challenge-123',
          expiresAt: new Date('2026-08-14T07:37:10Z'),
        })
      }
      return Promise.resolve({ status: 'connected' as const, displayName: 'Diver Dan' })
    },
    completeMfa(challengeId, code) {
      calls.push({ action: 'mfa', challengeId, code })
      if (options.mfaError) return Promise.reject(options.mfaError)
      return Promise.resolve({ status: 'connected' as const, displayName: 'Diver Dan' })
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

function jsonRequest(path: string, body: unknown, authorization?: string) {
  return new Request(`http://adapter.internal${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  })
}

const importRequest = (body: unknown, authorization?: string) =>
  jsonRequest('/import', body, authorization)

describe('authorization', () => {
  test('answers health checks without authorization', async () => {
    const response = await handler().fetch(new Request('http://adapter.internal/healthz'))
    expect(response.status).toBe(200)
  })

  test('rejects missing and wrong authorization on every other route', async () => {
    const { fetch } = handler()
    expect((await fetch(importRequest({ mode: 'full', state: {} }))).status).toBe(401)
    expect((await fetch(new Request('http://adapter.internal/account'))).status).toBe(401)
    expect(
      (await fetch(importRequest({ mode: 'full', state: {} }, 'Bearer other'))).status,
    ).toBe(401)
  })

  test('fails closed when no shared authorization is configured', async () => {
    const { fetch } = handler({ GARMIN_ADAPTER_AUTHORIZATION: undefined })
    expect((await fetch(importRequest({ mode: 'full', state: {} }))).status).toBe(503)
  })
})

describe('import endpoint', () => {
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

describe('account endpoints', () => {
  test('reports the connection status', async () => {
    const disconnected = await handler().fetch(
      new Request('http://adapter.internal/account', {
        headers: { authorization: 'Bearer adapter-secret' },
      }),
    )
    expect(await disconnected.json()).toEqual({ connected: false, tokensSavedAt: null })

    const connected = await handler({}, { connected: true }).fetch(
      new Request('http://adapter.internal/account', {
        headers: { authorization: 'Bearer adapter-secret' },
      }),
    )
    expect(await connected.json()).toEqual({
      connected: true,
      tokensSavedAt: '2026-08-14T07:32:10.000Z',
    })
  })

  test('logs in with credentials from the request body', async () => {
    const { fetch, calls } = handler({}, { connected: true })
    const response = await fetch(
      jsonRequest(
        '/account/login',
        { email: 'diver@example.test', password: 'secret' },
        'Bearer adapter-secret',
      ),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      connected: true,
      tokensSavedAt: '2026-08-14T07:32:10.000Z',
      displayName: 'Diver Dan',
    })
    expect(calls).toEqual([
      { action: 'login', email: 'diver@example.test', password: 'secret' },
    ])
  })

  test('requires both credentials fields', async () => {
    const { fetch, calls } = handler()
    const response = await fetch(
      jsonRequest(
        '/account/login',
        { email: 'diver@example.test' },
        'Bearer adapter-secret',
      ),
    )
    expect(response.status).toBe(400)
    expect(calls).toEqual([])
  })

  test('returns a resumable MFA challenge without credentials', async () => {
    const { fetch, calls } = handler({}, { mfaRequired: true })
    const response = await fetch(
      jsonRequest(
        '/account/login',
        { email: 'diver@example.test', password: 'secret' },
        'Bearer adapter-secret',
      ),
    )
    expect(response.status).toBe(202)
    const payload = await response.json()
    expect(payload).toEqual({
      mfaRequired: true,
      challengeId: 'challenge-123',
      expiresAt: '2026-08-14T07:37:10.000Z',
    })
    expect(JSON.stringify(payload)).not.toContain('secret')
    expect(calls[0]).toEqual({
      action: 'login',
      email: 'diver@example.test',
      password: 'secret',
    })
  })

  test('completes an MFA challenge', async () => {
    const { fetch, calls } = handler({}, { connected: true })
    const response = await fetch(
      jsonRequest(
        '/account/mfa',
        { challengeId: 'challenge-123', code: '654321' },
        'Bearer adapter-secret',
      ),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      connected: true,
      tokensSavedAt: '2026-08-14T07:32:10.000Z',
      displayName: 'Diver Dan',
    })
    expect(calls).toEqual([
      { action: 'mfa', challengeId: 'challenge-123', code: '654321' },
    ])
  })

  test('surfaces invalid or expired MFA challenges', async () => {
    const { fetch } = handler({}, { mfaError: new Error('Challenge expired') })
    const response = await fetch(
      jsonRequest(
        '/account/mfa',
        { challengeId: 'challenge-123', code: '000000' },
        'Bearer adapter-secret',
      ),
    )
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Challenge expired' })
  })

  test('surfaces Garmin login failures as HTTP 502 with the message', async () => {
    const { fetch } = handler({}, { loginError: new Error('MFA is not supported') })
    const response = await fetch(
      jsonRequest(
        '/account/login',
        { email: 'diver@example.test', password: 'secret' },
        'Bearer adapter-secret',
      ),
    )
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'MFA is not supported' })
  })

  test('logout clears tokens and returns the new status', async () => {
    const { fetch, calls } = handler()
    const response = await fetch(
      jsonRequest('/account/logout', {}, 'Bearer adapter-secret'),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ connected: false, tokensSavedAt: null })
    expect(calls).toEqual([{ action: 'logout' }])
  })
})
