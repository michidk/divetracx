import '@tanstack/react-start/server-only'

import { GarminConnect } from 'garmin-connect'
import {
  type GarminAdapterEnvironment,
  getGarminAdapterEnvironment,
} from './environment.server'
import {
  clearStoredTokens,
  ensureTokenDirectory,
  hasStoredTokens,
  storedTokensSavedAt,
} from './token-store.server'

export interface GarminAdapterLoginStatus {
  connected: boolean
  tokensSavedAt: Date | null
}

export interface GarminAdapterLoginManager {
  status(): GarminAdapterLoginStatus
  login(email: string, password: string): Promise<{ displayName: string | null }>
  logout(): void
}

/**
 * Browser-driven Garmin Connect login, mirroring liftosaur2garmin's setup
 * page: credentials are used once to obtain OAuth tokens and are never
 * stored; only the tokens persist in the token directory.
 */
export function createGarminLoginManager(
  environment: GarminAdapterEnvironment = getGarminAdapterEnvironment(),
): GarminAdapterLoginManager {
  return {
    status() {
      return {
        connected: hasStoredTokens(environment.GARMIN_TOKEN_DIRECTORY),
        tokensSavedAt: storedTokensSavedAt(environment.GARMIN_TOKEN_DIRECTORY),
      }
    },
    async login(email, password) {
      const client = new GarminConnect(
        { username: email, password },
        environment.GARMIN_DOMAIN,
      )
      try {
        await client.login()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Garmin login failed'
        if (message.includes('MFA')) {
          throw new Error(
            'Garmin Connect rejected the login. Accounts with multi-factor ' +
              'authentication are not supported yet; disable MFA or use an ' +
              'account without it.',
          )
        }
        throw new Error(message)
      }
      const profile = await client.getUserProfile().catch(() => null)
      ensureTokenDirectory(environment.GARMIN_TOKEN_DIRECTORY)
      client.exportTokenToFile(environment.GARMIN_TOKEN_DIRECTORY)
      return { displayName: profile?.displayName ?? null }
    },
    logout() {
      clearStoredTokens(environment.GARMIN_TOKEN_DIRECTORY)
    },
  }
}
