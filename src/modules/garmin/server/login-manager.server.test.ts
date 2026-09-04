import { describe, expect, test } from 'bun:test'
import {
  createGarminLoginManager,
  type GarminLoginDependencies,
  type GarminLoginSettings,
  type ResumableGarminClient,
} from './login-manager.server'

const environment: GarminLoginSettings = {
  GARMIN_DOMAIN: 'garmin.com',
  GARMIN_MFA_CHALLENGE_TTL_SECONDS: 300,
}

function fixture(options: { invalidMfa?: boolean } = {}) {
  let connected = false
  let tokensSavedAt: Date | null = null
  let now = new Date('2026-08-14T07:32:10Z')
  const calls: string[] = []
  const credentials = { username: 'diver@example.test', password: 'secret' }
  const client: ResumableGarminClient = {
    client: {
      lastSigninParams: { service: 'GarminConnect' },
      lastCsrfToken: 'csrf-token',
    },
    login() {
      calls.push('login')
      return Promise.reject(new Error('MFA_REQUIRED_SESSION'))
    },
    verifyMFA(code, signinParams, csrfToken) {
      calls.push(`mfa:${code}:${String(signinParams.service)}:${csrfToken}`)
      return options.invalidMfa
        ? Promise.reject(new Error('invalid code'))
        : Promise.resolve()
    },
    getUserProfile() {
      calls.push('profile')
      return Promise.resolve({ displayName: 'Diver Dan' })
    },
    exportToken() {
      calls.push('persist')
      return { oauth1: { token: 'oauth1' }, oauth2: { token: 'oauth2' } }
    },
  }
  const dependencies: GarminLoginDependencies = {
    createClient() {
      return client
    },
    createChallengeId: () => 'challenge-123',
    now: () => now,
    clearCredentials() {
      credentials.username = ''
      credentials.password = ''
      calls.push('clear-credentials')
    },
    async status() {
      return { connected, tokensSavedAt }
    },
    async persistTokens() {
      connected = true
      tokensSavedAt = now
    },
    async clearTokens() {
      connected = false
      tokensSavedAt = null
    },
  }
  return {
    manager: createGarminLoginManager(environment, dependencies),
    calls,
    credentials,
    advance(milliseconds: number) {
      now = new Date(now.getTime() + milliseconds)
    },
  }
}

describe('Garmin MFA login manager', () => {
  test('retains only an opaque challenge and completes the login', async () => {
    const { manager, calls, credentials } = fixture()

    const started = await manager.login('diver@example.test', 'secret')
    expect(started).toEqual({
      status: 'mfa-required',
      challengeId: 'challenge-123',
      expiresAt: new Date('2026-08-14T07:37:10Z'),
    })
    expect(credentials).toEqual({ username: '', password: '' })

    const completed = await manager.completeMfa('challenge-123', ' 654321 ')
    expect(completed).toEqual({ status: 'connected', displayName: 'Diver Dan' })
    await expect(manager.status()).resolves.toEqual({
      connected: true,
      tokensSavedAt: new Date('2026-08-14T07:32:10Z'),
    })
    expect(calls).toEqual([
      'login',
      'clear-credentials',
      'mfa:654321:GarminConnect:csrf-token',
      'clear-credentials',
      'profile',
      'persist',
    ])
  })

  test('expires abandoned challenges', async () => {
    const { manager, advance } = fixture()
    await manager.login('diver@example.test', 'secret')
    advance(301_000)
    await expect(manager.completeMfa('challenge-123', '654321')).rejects.toThrow(
      'challenge expired',
    )
  })

  test('invalidates a challenge after three failed codes', async () => {
    const { manager } = fixture({ invalidMfa: true })
    await manager.login('diver@example.test', 'secret')
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(manager.completeMfa('challenge-123', '000000')).rejects.toThrow(
        'verification failed',
      )
    }
    await expect(manager.completeMfa('challenge-123', '000000')).rejects.toThrow(
      'challenge expired',
    )
  })
})
