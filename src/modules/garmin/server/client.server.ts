import '@tanstack/react-start/server-only'

import { getServerEnv } from '@/env'
import type {
  GarminSourceActivity,
  GarminSourceBatch,
  GarminSourceClient,
} from '../types'

interface AdapterActivity {
  activityDetails?: unknown
  fitBase64?: unknown
  fitFileName?: unknown
  fitContentType?: unknown
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function decodeActivity(value: unknown, maximumFitBytes: number): GarminSourceActivity {
  const item = object(value) as AdapterActivity | null
  const details = object(item?.activityDetails)
  if (!item || !details) {
    throw new Error('Garmin adapter activity is missing activityDetails')
  }
  let fitBytes: Uint8Array | undefined
  if (item.fitBase64 !== undefined && item.fitBase64 !== null) {
    if (typeof item.fitBase64 !== 'string') {
      throw new Error('Garmin adapter fitBase64 must be a string')
    }
    fitBytes = Uint8Array.from(Buffer.from(item.fitBase64, 'base64'))
    if (fitBytes.byteLength > maximumFitBytes) {
      throw new Error(`Garmin FIT payload exceeds ${maximumFitBytes} bytes`)
    }
  }
  return {
    activityDetails: details,
    ...(fitBytes ? { fitBytes } : {}),
    fitFileName: typeof item.fitFileName === 'string' ? item.fitFileName : null,
    fitContentType: typeof item.fitContentType === 'string' ? item.fitContentType : null,
  }
}

function parseBatch(
  value: unknown,
  maximumFitBytes: number,
  fallbackDescription: string,
): GarminSourceBatch {
  const payload = object(value)
  if (!payload || !Array.isArray(payload.activities)) {
    throw new Error('Garmin adapter response must contain an activities array')
  }
  const nextState = object(payload.nextState)
  if (!nextState) {
    throw new Error('Garmin adapter response must contain opaque nextState')
  }
  return {
    activities: payload.activities.map((item) => decodeActivity(item, maximumFitBytes)),
    nextState,
    sourceDescription:
      typeof payload.sourceDescription === 'string' && payload.sourceDescription.trim()
        ? payload.sourceDescription
        : fallbackDescription,
    diagnostics: object(payload.diagnostics) ?? undefined,
  }
}

async function readLimitedJson(response: Response, maximumBytes: number) {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error(`Garmin adapter response exceeds ${maximumBytes} bytes`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maximumBytes) {
    throw new Error(`Garmin adapter response exceeds ${maximumBytes} bytes`)
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new Error('Garmin adapter returned invalid JSON')
  }
}

async function requestBatch(
  url: string | undefined,
  mode: 'full' | 'incremental',
  state: Record<string, unknown>,
  importSignal?: AbortSignal,
) {
  const environment = getServerEnv()
  if (!url) {
    throw new Error(
      `Garmin ${mode} import is unavailable until an approved Garmin Activity API adapter URL is configured`,
    )
  }
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    environment.GARMIN_ADAPTER_TIMEOUT_MS,
  )
  const abortFromImport = () => controller.abort(importSignal?.reason)
  importSignal?.addEventListener('abort', abortFromImport, { once: true })
  try {
    importSignal?.throwIfAborted()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(environment.GARMIN_ADAPTER_AUTHORIZATION
          ? { authorization: environment.GARMIN_ADAPTER_AUTHORIZATION }
          : {}),
      },
      body: JSON.stringify({ mode, state }),
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after')
      throw new Error(
        `Garmin adapter returned HTTP ${response.status}${
          retryAfter ? ` (retry after ${retryAfter})` : ''
        }`,
      )
    }
    const payload = await readLimitedJson(
      response,
      environment.GARMIN_ADAPTER_MAX_RESPONSE_BYTES,
    )
    return parseBatch(
      payload,
      environment.GARMIN_MAX_FIT_BYTES,
      `Garmin ${mode} Activity API adapter response`,
    )
  } catch (error) {
    if (importSignal?.aborted) throw importSignal.reason
    if (controller.signal.aborted) {
      throw new Error(
        `Garmin adapter request timed out after ${environment.GARMIN_ADAPTER_TIMEOUT_MS}ms`,
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
    importSignal?.removeEventListener('abort', abortFromImport)
  }
}

export function createGarminSourceClient(): GarminSourceClient {
  return {
    fetchFull(state, signal) {
      return requestBatch(
        getServerEnv().GARMIN_ADAPTER_FULL_IMPORT_URL,
        'full',
        state,
        signal,
      )
    },
    fetchIncremental(state, signal) {
      return requestBatch(
        getServerEnv().GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL,
        'incremental',
        state,
        signal,
      )
    },
  }
}
