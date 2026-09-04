import '@tanstack/react-start/server-only'

import { createGarminLoginManager, type GarminLoginManager } from './login-manager.server'

export interface GarminAccountStatus {
  /** Garmin Connect is built into this server and ready to be connected. */
  configured: true
  connected: boolean
  tokensSavedAt: string | null
  error: null
}

const loginManager: GarminLoginManager = createGarminLoginManager()

export async function loadGarminAccountStatus(): Promise<GarminAccountStatus> {
  const status = await loginManager.status()
  return {
    configured: true,
    connected: status.connected,
    tokensSavedAt: status.tokensSavedAt?.toISOString() ?? null,
    error: null,
  }
}

export async function connectGarminAccount(email: string, password: string) {
  const result = await loginManager.login(email, password)
  return result.status === 'mfa-required'
    ? {
        mfaRequired: true as const,
        challengeId: result.challengeId,
        expiresAt: result.expiresAt.toISOString(),
      }
    : {
        mfaRequired: false as const,
        displayName: result.displayName,
      }
}

export async function completeGarminMfaAccount(challengeId: string, code: string) {
  const result = await loginManager.completeMfa(challengeId, code)
  if (result.status !== 'connected') {
    throw new Error('Garmin returned another MFA challenge')
  }
  return { displayName: result.displayName }
}

export async function disconnectGarminAccount() {
  await loginManager.logout()
}
