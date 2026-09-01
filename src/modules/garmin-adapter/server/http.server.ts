import '@tanstack/react-start/server-only'

import { timingSafeEqual } from 'node:crypto'
import {
  type GarminAdapterEnvironment,
  getGarminAdapterEnvironment,
} from './environment.server'
import type { GarminAdapterBatchSource, GarminAdapterMode } from './source.server'

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function authorizationMatches(expected: string, received: string | null) {
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

export function createGarminAdapterFetchHandler(
  source: GarminAdapterBatchSource,
  environment: GarminAdapterEnvironment = getGarminAdapterEnvironment(),
) {
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname
    if (request.method === 'GET' && path === '/healthz') {
      return new Response('ok')
    }
    if (request.method !== 'POST' || (path !== '/' && path !== '/import')) {
      return json(404, { error: 'Use POST /import' })
    }
    if (!environment.GARMIN_ADAPTER_AUTHORIZATION) {
      return json(503, {
        error: 'GARMIN_ADAPTER_AUTHORIZATION is not configured on the adapter',
      })
    }
    if (
      !authorizationMatches(
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
}
