import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GarminAdapterEnvironment } from './environment.server'
import {
  createGarminLoginManager,
  type GarminLoginDependencies,
  type ResumableGarminClient,
} from './login.server'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function environment(tokenDirectory: string): GarminAdapterEnvironment {
  return {
    GARMIN_ADAPTER_PORT: 8787,
    GARMIN_ADAPTER_AUTHORIZATION: 'Bearer adapter-secret',
    GARMIN_TOKEN_DIRECTORY: tokenDirectory,
    GARMIN_DOMAIN: 'garmin.com',
    GARMIN_ACTIVITY_PAGE_SIZE: 50,
    GARMIN_FULL_IMPORT_MAX_ACTIVITIES: 2_000,
    GARMIN_INCREMENTAL_OVERLAP_SECONDS: 3_600,
    GARMIN_MFA_CHALLENGE_TTL_SECONDS: 300,
  }
}

function fixture(options: { invalidMfa?: boolean } = {}) {
  const tokenDirectory = mkdtempSync(join(tmpdir(), 'divetracx-garmin-login-'))
  temporaryDirectories.push(tokenDirectory)
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
    exportTokenToFile(directory) {
      calls.push('persist')
      writeFileSync(join(directory, 'oauth1_token.json'), '{}')
      writeFileSync(join(directory, 'oauth2_token.json'), '{}')
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
  }
  return {
    manager: createGarminLoginManager(environment(tokenDirectory), dependencies),
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
    expect(manager.status().connected).toBe(true)
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
