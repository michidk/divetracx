import '@tanstack/react-start/server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  OAuthError,
  OAuthErrorCode,
  type OAuthTokenVerifier,
} from '@modelcontextprotocol/server'
import { jwtVerify } from 'jose'
import type { McpConfig } from './config.server'
import type { OAuthStore } from './oauth-store.server'

function derivedSigningKey(secret: string) {
  return createHmac('sha256', secret)
    .update('divetracx:mcp-oauth:access-token:v1')
    .digest()
}

export function getOAuthSigningKey(secret: string) {
  return derivedSigningKey(secret)
}

function cookieValue(request: Request, name: string) {
  for (const pair of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = pair.trim().split('=')
    if (key === name) return value.join('=')
  }
  return undefined
}

export function hasValidOwnerSession(
  request: Request,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
) {
  const token = cookieValue(request, 'hodor')
  if (!token) return false
  const [expiryText, signatureHex, ...extra] = token.split('|')
  if (!expiryText || !signatureHex || extra.length > 0) return false
  const expiry = Number(expiryText)
  if (!Number.isSafeInteger(expiry) || expiry < nowSeconds) return false

  let actual: Buffer
  try {
    actual = Buffer.from(signatureHex, 'hex')
  } catch {
    return false
  }
  const expected = createHmac('sha256', secret).update(expiryText).digest()
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createLocalTokenVerifier(
  config: McpConfig,
  store: Pick<OAuthStore, 'getActiveAccessToken'>,
): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token) {
      try {
        const { payload } = await jwtVerify(
          token,
          derivedSigningKey(config.signingSecret),
          {
            algorithms: ['HS256'],
            issuer: config.issuer.toString(),
            audience: config.serverUrl.toString(),
            typ: 'JWT',
          },
        )
        if (
          typeof payload.jti !== 'string' ||
          typeof payload.cid !== 'string' ||
          typeof payload.exp !== 'number' ||
          typeof payload.scope !== 'string'
        ) {
          throw new Error('Missing access-token claims')
        }
        const scopes = payload.scope.split(' ').filter(Boolean)
        const active = await store.getActiveAccessToken(payload.jti)
        if (!active || active.clientId !== payload.cid) throw new Error('Token revoked')
        return {
          token,
          clientId: payload.cid,
          scopes,
          expiresAt: payload.exp,
          resource: config.serverUrl,
        }
      } catch {
        throw new OAuthError(
          OAuthErrorCode.InvalidToken,
          'The access token is invalid, expired, or revoked',
        )
      }
    },
  }
}
