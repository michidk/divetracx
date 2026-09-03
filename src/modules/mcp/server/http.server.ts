import '@tanstack/react-start/server-only'

import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  hostHeaderValidationResponse,
  requireBearerAuth,
} from '@modelcontextprotocol/server'
import { createLocalTokenVerifier } from './auth.server'
import { getMcpConfig, MCP_READ_SCOPE, type McpConfig } from './config.server'
import { createOAuthHttpHandler, oauthPublicPaths } from './oauth-http.server'
import { DrizzleOAuthStore, type OAuthStore } from './oauth-store.server'
import { createDivetracxMcpServer } from './tools.server'

const MCP_PATH = '/api/mcp'
const defaultProtocolHandler = createMcpHandler(() => createDivetracxMcpServer())

type ProtocolHandler = {
  fetch(request: Request, options: Record<string, unknown>): Promise<Response>
}

function corsOrigin(request: Request, config: McpConfig) {
  const origin = request.headers.get('origin')
  if (!origin) return null
  const allowed = new Set([config.issuer.origin, ...config.allowedOrigins])
  return allowed.has(origin) ? origin : false
}

function withMcpCors(response: Response, origin: string | null) {
  if (!origin) return response
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', origin)
  headers.append('Vary', 'Origin')
  headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Protocol-Version')
  return new Response(response.body, { status: response.status, headers })
}

function mcpPreflight(origin: string) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version, MCP-Method, MCP-Name',
      'Access-Control-Expose-Headers': 'WWW-Authenticate, MCP-Protocol-Version',
      'Access-Control-Max-Age': '86400',
    },
  })
}

async function calledToolName(request: Request) {
  if (request.method !== 'POST') return undefined
  try {
    const body = (await request.clone().json()) as {
      method?: unknown
      params?: { name?: unknown }
    }
    return body.method === 'tools/call' && typeof body.params?.name === 'string'
      ? body.params.name.slice(0, 200)
      : undefined
  } catch {
    return undefined
  }
}

async function recordToolAudit(
  store: OAuthStore,
  event: Parameters<OAuthStore['audit']>[0],
) {
  try {
    await store.audit(event)
  } catch {
    console.error('Failed to persist an MCP tool audit event')
  }
}

export function createMcpHttpHandler(
  config: McpConfig,
  store: OAuthStore,
  protocolHandler: ProtocolHandler = defaultProtocolHandler,
) {
  const oauthHandler = createOAuthHttpHandler(config, store)
  const authGate = requireBearerAuth({
    verifier: createLocalTokenVerifier(config, store),
    requiredScopes: [MCP_READ_SCOPE],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(config.serverUrl),
  })

  return async (request: Request): Promise<Response | null> => {
    const pathname = new URL(request.url).pathname
    if (pathname !== MCP_PATH) {
      if (oauthPublicPaths().includes(pathname)) {
        const rejectedHost = hostHeaderValidationResponse(
          request,
          config.allowedHostnames,
        )
        if (rejectedHost) return rejectedHost
      }
      return oauthHandler(request)
    }

    const rejectedHost = hostHeaderValidationResponse(request, config.allowedHostnames)
    if (rejectedHost) return rejectedHost

    const origin = corsOrigin(request, config)
    if (origin === false) return new Response('Forbidden origin', { status: 403 })
    if (request.method === 'OPTIONS') return mcpPreflight(origin ?? config.issuer.origin)

    const auth = await authGate(request)
    if (auth instanceof Response) return withMcpCors(auth, origin)

    const toolName = await calledToolName(request)
    try {
      const response = await protocolHandler.fetch(request, { authInfo: auth })
      if (toolName) {
        await recordToolAudit(store, {
          event: 'tool_called',
          outcome: response.ok ? 'success' : 'failure',
          clientId: auth.clientId,
          toolName,
        })
      }
      return withMcpCors(response, origin)
    } catch (error) {
      if (toolName) {
        await recordToolAudit(store, {
          event: 'tool_called',
          outcome: 'failure',
          clientId: auth.clientId,
          toolName,
        })
      }
      throw error
    }
  }
}

let handler: ReturnType<typeof createMcpHttpHandler> | undefined
let configured = false

export async function handleMcpHttpRequest(request: Request): Promise<Response | null> {
  try {
    if (!configured) {
      const config = getMcpConfig()
      handler = config ? createMcpHttpHandler(config, new DrizzleOAuthStore()) : undefined
      configured = true
    }
    return handler ? await handler(request) : null
  } catch (error) {
    console.error('MCP request failed', error)
    return Response.json(
      { error: 'server_error', error_description: 'MCP service is unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
