import '@tanstack/react-start/server-only'

import { timingSafeEqual } from 'node:crypto'
import {
  type GarminAdapterEnvironment,
  getGarminAdapterEnvironment,
} from './environment.server'
import { createGarminLoginManager, type GarminAdapterLoginManager } from './login.server'
import type { GarminAdapterBatchSource, GarminAdapterMode } from './source.server'

export interface GarminAdapterDependencies {
  source: GarminAdapterBatchSource
  loginManager: GarminAdapterLoginManager
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function secretMatches(expected: string, received: string | null) {
  if (received === null) return false
  const expectedBytes = Buffer.from(expected)
  const receivedBytes = Buffer.from(received)
  if (expectedBytes.byteLength !== receivedBytes.byteLength) return false
  return timingSafeEqual(expectedBytes, receivedBytes)
}

function parseMode(value: unknown): GarminAdapterMode | null {
  return value === 'full' || value === 'incremental' ? value : null
}

function parseState(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return {}
  return typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function stringField(body: Record<string, unknown> | null, name: string) {
  const value = body?.[name]
  return typeof value === 'string' && value ? value : null
}

function accountStatus(loginManager: GarminAdapterLoginManager) {
  const status = loginManager.status()
  return {
    connected: status.connected,
    tokensSavedAt: status.tokensSavedAt?.toISOString() ?? null,
  }
}

async function handleImport(request: Request, source: GarminAdapterBatchSource) {
  const body = await jsonBody(request)
  const mode = parseMode(body?.mode)
  const state = parseState(body?.state)
  if (!body || !mode || state === null) {
    return json(400, {
      error: 'Request body must contain {"mode": "full" | "incremental", "state": {}}',
    })
  }
  try {
    const batch = await source.fetchBatch(mode, state)
    return json(200, batch as unknown as Record<string, unknown>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown adapter error'
    console.error(`Garmin adapter ${mode} batch failed: ${message}`)
    return json(500, { error: message })
  }
}

async function handleLogin(request: Request, loginManager: GarminAdapterLoginManager) {
  const body = await jsonBody(request)
  const email = stringField(body, 'email')
  const password = stringField(body, 'password')
  if (!email || !password) {
    return json(400, { error: 'Request body must contain email and password' })
  }
  try {
    const result = await loginManager.login(email, password)
    return json(200, {
      ...accountStatus(loginManager),
      displayName: result.displayName,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Garmin login failed'
    return json(502, { error: message })
  }
}

/**
 * JSON API consumed by the Divetracx application (never by a browser): the
 * import batch endpoint plus Garmin account management, all behind the shared
 * authorization value. Divetracx's sync settings page proxies account
 * connect/disconnect requests here.
 */
export function createGarminAdapterFetchHandler(
  dependencies: GarminAdapterDependencies,
  environment: GarminAdapterEnvironment = getGarminAdapterEnvironment(),
) {
  const { source, loginManager } = dependencies
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname
    if (request.method === 'GET' && path === '/healthz') {
      return new Response('ok')
    }

    if (!environment.GARMIN_ADAPTER_AUTHORIZATION) {
      return json(503, {
        error: 'GARMIN_ADAPTER_AUTHORIZATION is not configured on the adapter',
      })
    }
    if (
      !secretMatches(
        environment.GARMIN_ADAPTER_AUTHORIZATION,
        request.headers.get('authorization'),
      )
    ) {
      return json(401, { error: 'Invalid adapter authorization' })
    }

    if (request.method === 'POST' && path === '/import') {
      return handleImport(request, source)
    }
    if (request.method === 'GET' && path === '/account') {
      return json(200, accountStatus(loginManager))
    }
    if (request.method === 'POST' && path === '/account/login') {
      return handleLogin(request, loginManager)
    }
    if (request.method === 'POST' && path === '/account/logout') {
      loginManager.logout()
      return json(200, accountStatus(loginManager))
    }

    return json(404, {
      error: 'Use POST /import, GET /account, POST /account/login, POST /account/logout',
    })
  }
}

export function createGarminAdapterDependencies(
  environment: GarminAdapterEnvironment,
  source: GarminAdapterBatchSource,
): GarminAdapterDependencies {
  return { source, loginManager: createGarminLoginManager(environment) }
}
