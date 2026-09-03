import '@tanstack/react-start/server-only'

import { getServerEnv } from '@/env'

export interface GarminAccountStatus {
  /** Adapter URL and shared authorization are configured on this server. */
  configured: boolean
  connected: boolean
  tokensSavedAt: string | null
  /** Status probe failure (adapter unreachable, misconfigured, …). */
  error: string | null
}

interface AdapterAccountTarget {
  url: string
  authorization: string
}

/**
 * Account endpoints are served by the bundled adapter next to the import
 * endpoint, so their URLs are derived from the configured import URL origin.
 */
function adapterAccountTarget(
  path: '/account' | '/account/login' | '/account/mfa' | '/account/logout',
): AdapterAccountTarget | null {
  const environment = getServerEnv()
  const base =
    environment.GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL ??
    environment.GARMIN_ADAPTER_FULL_IMPORT_URL
  if (!base || !environment.GARMIN_ADAPTER_AUTHORIZATION) return null
  return {
    url: new URL(path, base).toString(),
    authorization: environment.GARMIN_ADAPTER_AUTHORIZATION,
  }
}

async function accountRequest(
  target: AdapterAccountTarget,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
) {
  const environment = getServerEnv()
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    environment.GARMIN_ADAPTER_TIMEOUT_MS,
  )
  try {
    const response = await fetch(target.url, {
      method,
      headers: {
        accept: 'application/json',
        authorization: target.authorization,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: controller.signal,
    })
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      const message =
        typeof payload.error === 'string'
          ? payload.error
          : `Garmin adapter returned HTTP ${response.status}`
      throw new Error(message)
    }
    return payload
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Garmin adapter request timed out after ${environment.GARMIN_ADAPTER_TIMEOUT_MS}ms`,
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/** Never throws: the settings page must render even when the adapter is down. */
export async function loadGarminAccountStatus(): Promise<GarminAccountStatus> {
  const target = adapterAccountTarget('/account')
  if (!target) {
    return { configured: false, connected: false, tokensSavedAt: null, error: null }
  }
  try {
    const payload = await accountRequest(target, 'GET')
    return {
      configured: true,
      connected: payload.connected === true,
      tokensSavedAt:
        typeof payload.tokensSavedAt === 'string' ? payload.tokensSavedAt : null,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      connected: false,
      tokensSavedAt: null,
      error:
        error instanceof Error ? error.message : 'Garmin adapter status check failed',
    }
  }
}

export async function connectGarminAccount(email: string, password: string) {
  const target = adapterAccountTarget('/account/login')
  if (!target) {
    throw new Error('The Garmin adapter is not configured on this server')
  }
  const payload = await accountRequest(target, 'POST', { email, password })
  if (payload.mfaRequired === true) {
    if (
      typeof payload.challengeId !== 'string' ||
      typeof payload.expiresAt !== 'string'
    ) {
      throw new Error('Garmin adapter returned an invalid MFA challenge')
    }
    return {
      mfaRequired: true as const,
      challengeId: payload.challengeId,
      expiresAt: payload.expiresAt,
    }
  }
  return {
    mfaRequired: false as const,
    displayName: typeof payload.displayName === 'string' ? payload.displayName : null,
  }
}

export async function completeGarminMfaAccount(challengeId: string, code: string) {
  const target = adapterAccountTarget('/account/mfa')
  if (!target) {
    throw new Error('The Garmin adapter is not configured on this server')
  }
  const payload = await accountRequest(target, 'POST', { challengeId, code })
  return {
    displayName: typeof payload.displayName === 'string' ? payload.displayName : null,
  }
}

export async function disconnectGarminAccount() {
  const target = adapterAccountTarget('/account/logout')
  if (!target) {
    throw new Error('The Garmin adapter is not configured on this server')
  }
  await accountRequest(target, 'POST', {})
}
