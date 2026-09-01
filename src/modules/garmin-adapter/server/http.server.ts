import '@tanstack/react-start/server-only'

import { timingSafeEqual } from 'node:crypto'
import { renderGarminAdapterPage } from '../ui'
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

/** Extracts the password from a `Basic` authorization header; any username. */
function basicAuthPassword(header: string | null): string | null {
  if (!header?.startsWith('Basic ')) return null
  try {
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString()
    const separator = decoded.indexOf(':')
    return separator === -1 ? null : decoded.slice(separator + 1)
  } catch {
    return null
  }
}

function unauthorizedUi() {
  return new Response('Authentication required', {
    status: 401,
    headers: { 'www-authenticate': 'Basic realm="Divetracx Garmin adapter"' },
  })
}

function redirect(parameters: Record<string, string>) {
  const query = new URLSearchParams(parameters).toString()
  return new Response(null, {
    status: 303,
    headers: { location: query ? `/?${query}` : '/' },
  })
}

async function handleImport(
  request: Request,
  source: GarminAdapterBatchSource,
  environment: GarminAdapterEnvironment,
) {
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
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'Request body must be JSON' })
  }
  const payload =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const mode = parseMode(payload.mode)
  const state = parseState(payload.state)
  if (!mode || state === null) {
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

function formField(form: FormData | null, name: string) {
  const value = form?.get(name)
  return typeof value === 'string' && value ? value : null
}

export function createGarminAdapterFetchHandler(
  dependencies: GarminAdapterDependencies,
  environment: GarminAdapterEnvironment = getGarminAdapterEnvironment(),
) {
  const { source, loginManager } = dependencies
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'GET' && path === '/healthz') {
      return new Response('ok')
    }
    if (request.method === 'POST' && (path === '/import' || path === '/api/import')) {
      return handleImport(request, source, environment)
    }

    // Everything below is the browser setup UI, optionally gated by a
    // password (Basic auth, liftosaur2garmin-style).
    const uiPassword = environment.GARMIN_ADAPTER_UI_PASSWORD
    if (
      uiPassword &&
      !secretMatches(uiPassword, basicAuthPassword(request.headers.get('authorization')))
    ) {
      return unauthorizedUi()
    }

    if (request.method === 'GET' && path === '/') {
      const status = loginManager.status()
      return new Response(
        renderGarminAdapterPage({
          connected: status.connected,
          tokensSavedAt: status.tokensSavedAt,
          message: url.searchParams.get('message'),
          error: url.searchParams.get('error'),
        }),
        { headers: { 'content-type': 'text/html; charset=utf-8' } },
      )
    }
    if (request.method === 'POST' && path === '/login') {
      const form = await request.formData().catch(() => null)
      const email = formField(form, 'email')
      const password = formField(form, 'password')
      if (!email || !password) {
        return redirect({ error: 'Email and password are required' })
      }
      try {
        const result = await loginManager.login(email, password)
        return redirect({
          message: `Logged in${result.displayName ? ` as ${result.displayName}` : ''}; tokens saved`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Garmin login failed'
        return redirect({ error: message })
      }
    }
    if (request.method === 'POST' && path === '/logout') {
      loginManager.logout()
      return redirect({ message: 'Disconnected; stored tokens deleted' })
    }

    return json(404, { error: 'Use GET /, POST /login, POST /logout, POST /import' })
  }
}

export function createGarminAdapterDependencies(
  environment: GarminAdapterEnvironment,
  source: GarminAdapterBatchSource,
): GarminAdapterDependencies {
  return { source, loginManager: createGarminLoginManager(environment) }
}
