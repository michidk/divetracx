import '@tanstack/react-start/server-only'

import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  hostHeaderValidationResponse,
  oauthMetadataResponse,
  originValidationResponse,
  requireBearerAuth,
} from '@modelcontextprotocol/server'
import { createJwtTokenVerifier, discoverOAuthMetadata } from './auth.server'
import { getMcpConfig, type McpConfig } from './config.server'
import { createDivetracxMcpServer } from './tools.server'

const MCP_PATH = '/api/mcp'
const mcpHandler = createMcpHandler(() => createDivetracxMcpServer())

let cachedConfig: McpConfig | null | undefined
let configLoaded = false
let metadataPromise: ReturnType<typeof discoverOAuthMetadata> | undefined
let authGate: ReturnType<typeof requireBearerAuth> | undefined

function loadConfig() {
  if (!configLoaded) {
    cachedConfig = getMcpConfig()
    configLoaded = true
  }
  return cachedConfig
}

function loadMetadata(config: McpConfig) {
  metadataPromise ??= discoverOAuthMetadata(config).catch((error) => {
    metadataPromise = undefined
    throw error
  })
  return metadataPromise
}

function loadAuthGate(config: McpConfig) {
  authGate ??= requireBearerAuth({
    verifier: createJwtTokenVerifier(config, () => loadMetadata(config)),
    requiredScopes: [config.scope],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(config.serverUrl),
  })
  return authGate
}

const MCP_HTTP_PATHS = [
  MCP_PATH,
  '/.well-known/oauth-protected-resource/api/mcp',
  '/.well-known/oauth-authorization-server',
]

export async function handleMcpHttpRequest(request: Request): Promise<Response | null> {
  const pathname = new URL(request.url).pathname
  if (!MCP_HTTP_PATHS.includes(pathname)) return null

  try {
    const config = loadConfig()
    if (!config) return null

    const rejectedHost = hostHeaderValidationResponse(request, config.allowedHostnames)
    if (rejectedHost) return rejectedHost

    if (config.allowedOriginHostnames.length > 0) {
      const rejectedOrigin = originValidationResponse(
        request,
        config.allowedOriginHostnames,
      )
      if (rejectedOrigin) return rejectedOrigin
    }

    const oauthMetadata = await loadMetadata(config)
    const metadataResponse = oauthMetadataResponse(request, {
      oauthMetadata,
      resourceServerUrl: config.serverUrl,
      scopesSupported: [config.scope],
      resourceName: 'Divetracx dive log',
      dangerouslyAllowInsecureIssuerUrl: config.dangerouslyAllowInsecureUrls,
    })
    if (metadataResponse) return metadataResponse

    if (pathname !== MCP_PATH) return null

    const auth = await loadAuthGate(config)(request)
    if (auth instanceof Response) return auth
    return mcpHandler.fetch(request, { authInfo: auth })
  } catch (error) {
    console.error('MCP request failed', error)
    return Response.json(
      { error: 'server_error', error_description: 'MCP service is unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
