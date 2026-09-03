import '@tanstack/react-start/server-only'

import {
  type AuthInfo,
  OAuthError,
  OAuthErrorCode,
  type OAuthMetadata,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server'
import {
  createRemoteJWKSet,
  type JWTPayload,
  type JWTVerifyGetKey,
  jwtVerify,
} from 'jose'
import { z } from 'zod'
import type { McpConfig } from './config.server'

const discoverySchema = z
  .object({
    issuer: z.url(),
    authorization_endpoint: z.url(),
    token_endpoint: z.url(),
    jwks_uri: z.url(),
    registration_endpoint: z.url().optional(),
    scopes_supported: z.array(z.string()).optional(),
    response_types_supported: z.array(z.string()),
    response_modes_supported: z.array(z.string()).optional(),
    grant_types_supported: z.array(z.string()).optional(),
    token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
    code_challenge_methods_supported: z.array(z.string()).optional(),
    client_id_metadata_document_supported: z.boolean().optional(),
    authorization_response_iss_parameter_supported: z.boolean().optional(),
  })
  .loose()

export type DiscoveredOAuthMetadata = OAuthMetadata & { jwks_uri: string }

function normalizedIssuer(value: string | URL) {
  return new URL(value).toString().replace(/\/$/, '')
}

export function oauthDiscoveryUrls(issuer: URL) {
  const issuerPath = issuer.pathname.replace(/\/$/, '')
  return [
    new URL(`${issuerPath}/.well-known/openid-configuration`, issuer.origin),
    new URL(`/.well-known/oauth-authorization-server${issuerPath}`, issuer.origin),
  ]
}

export async function discoverOAuthMetadata(
  config: McpConfig,
  fetcher: typeof fetch = fetch,
): Promise<DiscoveredOAuthMetadata> {
  let lastError: unknown

  for (const url of oauthDiscoveryUrls(config.issuer)) {
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      })
      if (!response.ok) {
        lastError = new Error(`OAuth discovery returned HTTP ${response.status}`)
        continue
      }

      const metadata = discoverySchema.parse(await response.json())
      if (normalizedIssuer(metadata.issuer) !== normalizedIssuer(config.issuer)) {
        throw new Error('OAuth discovery issuer does not match MCP_OAUTH_ISSUER')
      }
      return metadata
    } catch (error) {
      lastError = error
    }
  }

  throw new Error('Unable to discover the configured OAuth issuer', {
    cause: lastError,
  })
}

export function scopesFromPayload(payload: JWTPayload) {
  if (typeof payload.scope === 'string') {
    return payload.scope.split(/\s+/).filter(Boolean)
  }
  if (Array.isArray(payload.scp)) {
    return payload.scp.filter((scope): scope is string => typeof scope === 'string')
  }
  return []
}

export function createJwtTokenVerifier(
  config: McpConfig,
  loadMetadata: () => Promise<DiscoveredOAuthMetadata>,
  createKeySet: (url: URL) => JWTVerifyGetKey = createRemoteJWKSet,
): OAuthTokenVerifier {
  const keySets = new Map<string, JWTVerifyGetKey>()

  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      try {
        const metadata = await loadMetadata()
        let keySet = keySets.get(metadata.jwks_uri)
        if (!keySet) {
          keySet = createKeySet(new URL(metadata.jwks_uri))
          keySets.set(metadata.jwks_uri, keySet)
        }

        const { payload } = await jwtVerify(token, keySet, {
          issuer: metadata.issuer,
          audience: config.audience,
          algorithms: [
            'RS256',
            'RS384',
            'RS512',
            'PS256',
            'PS384',
            'PS512',
            'ES256',
            'ES384',
            'ES512',
            'EdDSA',
          ],
        })

        if (!payload.exp) throw new Error('Access token has no expiration')
        const clientId =
          (typeof payload.client_id === 'string' && payload.client_id) ||
          (typeof payload.azp === 'string' && payload.azp) ||
          payload.sub
        if (!clientId) throw new Error('Access token has no client identifier')

        return {
          token,
          clientId,
          scopes: scopesFromPayload(payload),
          expiresAt: payload.exp,
        }
      } catch (error) {
        if (OAuthError.isInstance(error)) throw error
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          'Invalid or expired access token',
        )
      }
    },
  }
}
