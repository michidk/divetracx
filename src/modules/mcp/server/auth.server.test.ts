import { describe, expect, test } from 'bun:test'
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server'
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from 'jose'
import {
  createJwtTokenVerifier,
  type DiscoveredOAuthMetadata,
  oauthDiscoveryUrls,
  scopesFromPayload,
} from './auth.server'
import type { McpConfig } from './config.server'

const config: McpConfig = {
  serverUrl: new URL('https://dives.example.com/api/mcp'),
  issuer: new URL('https://auth.example.com/realms/divetracx'),
  audience: 'https://dives.example.com/api/mcp',
  scope: 'divetracx:read',
  allowedHostnames: ['dives.example.com'],
  allowedOriginHostnames: [],
  dangerouslyAllowInsecureUrls: false,
}

const metadata: DiscoveredOAuthMetadata = {
  issuer: config.issuer.toString(),
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/token',
  jwks_uri: 'https://auth.example.com/jwks',
  response_types_supported: ['code'],
}

async function jwtFixture(payload: JWTPayload) {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const publicJwk = await exportJWK(publicKey)
  publicJwk.kid = 'test-key'
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(metadata.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)

  return { token, keySet: createLocalJWKSet({ keys: [publicJwk] }) }
}

describe('MCP OAuth', () => {
  test('builds OIDC and RFC 8414 discovery URLs for a path-based issuer', () => {
    expect(oauthDiscoveryUrls(config.issuer).map(String)).toEqual([
      'https://auth.example.com/realms/divetracx/.well-known/openid-configuration',
      'https://auth.example.com/.well-known/oauth-authorization-server/realms/divetracx',
    ])
  })

  test('reads standard string and array scope claims', () => {
    expect(scopesFromPayload({ scope: 'openid divetracx:read' })).toEqual([
      'openid',
      'divetracx:read',
    ])
    expect(scopesFromPayload({ scp: ['divetracx:read'] })).toEqual(['divetracx:read'])
  })

  test('validates a signed, scoped JWT access token', async () => {
    const { token, keySet } = await jwtFixture({
      sub: 'owner',
      client_id: 'codex',
      scope: 'openid divetracx:read',
    })
    const verifier = createJwtTokenVerifier(
      config,
      async () => metadata,
      () => keySet,
    )

    expect(await verifier.verifyAccessToken(token)).toMatchObject({
      token,
      clientId: 'codex',
      scopes: ['openid', 'divetracx:read'],
    })
  })

  test('rejects a token issued for another audience without leaking details', async () => {
    const { token, keySet } = await jwtFixture({ sub: 'owner' })
    const verifier = createJwtTokenVerifier(
      { ...config, audience: 'https://other.example.com/api/mcp' },
      async () => metadata,
      () => keySet,
    )

    try {
      await verifier.verifyAccessToken(token)
      throw new Error('Expected verification to fail')
    } catch (error) {
      expect(OAuthError.isInstance(error)).toBe(true)
      expect((error as OAuthError).code).toBe(OAuthErrorCode.InvalidToken)
      expect((error as Error).message).toBe('Invalid or expired access token')
    }
  })
})
