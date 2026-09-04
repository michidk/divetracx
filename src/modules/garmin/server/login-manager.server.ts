import '@tanstack/react-start/server-only'

import { randomUUID } from 'node:crypto'
import { GarminConnect } from 'garmin-connect-2fa'
import { getServerEnv } from '@/env'
import {
  clearGarminTokens,
  type GarminTokens,
  loadGarminTokenStatus,
  saveGarminTokens,
} from './credentials.server'

export interface GarminLoginStatus {
  connected: boolean
  tokensSavedAt: Date | null
}

export type GarminLoginResult =
  | { status: 'connected'; displayName: string | null }
  | { status: 'mfa-required'; challengeId: string; expiresAt: Date }

export interface GarminLoginManager {
  status(): Promise<GarminLoginStatus>
  login(email: string, password: string): Promise<GarminLoginResult>
  completeMfa(challengeId: string, code: string): Promise<GarminLoginResult>
  logout(): Promise<void>
}

export interface ResumableGarminClient {
  client: {
    lastSigninParams?: Record<string, unknown>
    lastCsrfToken?: string
  }
  login(): Promise<unknown>
  verifyMFA(
    code: string,
    signinParams: Record<string, unknown>,
    csrfToken: string,
  ): Promise<unknown>
  getUserProfile(): Promise<{ displayName?: string | null }>
  exportToken(): GarminTokens
}

export interface GarminLoginDependencies {
  createClient(
    email: string,
    password: string,
    domain: 'garmin.com' | 'garmin.cn',
  ): ResumableGarminClient
  createChallengeId(): string
  now(): Date
  clearCredentials(client: ResumableGarminClient): void
  status(): Promise<GarminLoginStatus>
  persistTokens(tokens: GarminTokens): Promise<void>
  clearTokens(): Promise<void>
}

export interface GarminLoginSettings {
  GARMIN_DOMAIN: 'garmin.com' | 'garmin.cn'
  GARMIN_MFA_CHALLENGE_TTL_SECONDS: number
}

interface PendingChallenge {
  client: ResumableGarminClient
  signinParams: Record<string, unknown>
  csrfToken: string
  expiresAt: Date
  failedAttempts: number
}

const defaultDependencies: GarminLoginDependencies = {
  createClient(email, password, domain) {
    return new GarminConnect(
      {
        username: email,
        password,
      },
      domain,
    ) as unknown as ResumableGarminClient
  },
  createChallengeId: randomUUID,
  now: () => new Date(),
  clearCredentials(client) {
    // The upstream client keeps constructor credentials on the instance. They
    // are unnecessary after the first SSO POST, so erase them before retaining
    // an MFA challenge in memory or persisting the resulting tokens.
    const mutable = client as ResumableGarminClient & {
      credentials?: { username: string; password: string }
    }
    if (mutable.credentials) {
      mutable.credentials.username = ''
      mutable.credentials.password = ''
    }
  },
  status: loadGarminTokenStatus,
  persistTokens: saveGarminTokens,
  clearTokens: clearGarminTokens,
}

function isMfaChallenge(error: unknown) {
  return error instanceof Error && error.message.includes('MFA_REQUIRED_SESSION')
}

/**
 * Two-step Garmin Connect login. Only the cookie jar, CSRF context, and an
 * opaque short-lived challenge ID survive while the user enters an MFA code.
 */
export function createGarminLoginManager(
  environment: GarminLoginSettings = getServerEnv(),
  dependencies: GarminLoginDependencies = defaultDependencies,
): GarminLoginManager {
  const pending = new Map<string, PendingChallenge>()

  function pruneExpiredChallenges() {
    const now = dependencies.now().getTime()
    for (const [id, challenge] of pending) {
      if (challenge.expiresAt.getTime() <= now) pending.delete(id)
    }
  }

  async function persistConnectedClient(client: ResumableGarminClient) {
    dependencies.clearCredentials(client)
    const profile = await client.getUserProfile().catch(() => null)
    await dependencies.persistTokens(client.exportToken())
    return {
      status: 'connected' as const,
      displayName: profile?.displayName ?? null,
    }
  }

  return {
    async status() {
      pruneExpiredChallenges()
      return dependencies.status()
    },
    async login(email, password) {
      pending.clear()
      const client = dependencies.createClient(email, password, environment.GARMIN_DOMAIN)
      try {
        await client.login()
        return persistConnectedClient(client)
      } catch (error) {
        dependencies.clearCredentials(client)
        if (!isMfaChallenge(error)) throw error

        const signinParams = client.client.lastSigninParams
        const csrfToken = client.client.lastCsrfToken
        if (!signinParams || !csrfToken) {
          throw new Error('Garmin requested MFA but did not return resumable login state')
        }
        const challengeId = dependencies.createChallengeId()
        const expiresAt = new Date(
          dependencies.now().getTime() +
            environment.GARMIN_MFA_CHALLENGE_TTL_SECONDS * 1_000,
        )
        pending.set(challengeId, {
          client,
          signinParams,
          csrfToken,
          expiresAt,
          failedAttempts: 0,
        })
        return { status: 'mfa-required', challengeId, expiresAt }
      }
    },
    async completeMfa(challengeId, code) {
      pruneExpiredChallenges()
      const challenge = pending.get(challengeId)
      if (!challenge) {
        throw new Error('The Garmin MFA challenge expired; sign in again')
      }
      challenge.failedAttempts += 1
      try {
        await challenge.client.verifyMFA(
          code.trim(),
          challenge.signinParams,
          challenge.csrfToken,
        )
      } catch (error) {
        if (challenge.failedAttempts >= 3) pending.delete(challengeId)
        const message =
          error instanceof Error ? error.message : 'Garmin rejected the code'
        throw new Error(`Garmin MFA verification failed: ${message}`)
      }
      pending.delete(challengeId)
      return persistConnectedClient(challenge.client)
    },
    async logout() {
      pending.clear()
      await dependencies.clearTokens()
    },
  }
}
