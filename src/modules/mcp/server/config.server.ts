import '@tanstack/react-start/server-only'

import { getServerEnv } from '@/env'

export type McpConfig = {
  serverUrl: URL
  issuer: URL
  audience: string
  scope: string
  allowedHostnames: string[]
  allowedOriginHostnames: string[]
  dangerouslyAllowInsecureUrls: boolean
}

type McpEnvironment = {
  MCP_SERVER_URL?: string
  MCP_OAUTH_ISSUER?: string
  MCP_OAUTH_AUDIENCE?: string
  MCP_OAUTH_SCOPE: string
  MCP_ALLOWED_ORIGINS?: string
}

function isLoopback(url: URL) {
  return ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
}

function requireSecureUrl(name: string, url: URL) {
  if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url))) {
    return
  }

  throw new Error(`${name} must use HTTPS unless it targets localhost`)
}

export function resolveMcpConfig(environment: McpEnvironment): McpConfig | null {
  const { MCP_SERVER_URL: serverUrlValue, MCP_OAUTH_ISSUER: issuerValue } = environment

  if (!serverUrlValue && !issuerValue) return null
  if (!serverUrlValue || !issuerValue) {
    throw new Error('MCP_SERVER_URL and MCP_OAUTH_ISSUER must be configured together')
  }

  const serverUrl = new URL(serverUrlValue)
  const issuer = new URL(issuerValue)
  requireSecureUrl('MCP_SERVER_URL', serverUrl)
  requireSecureUrl('MCP_OAUTH_ISSUER', issuer)

  if (serverUrl.search || serverUrl.hash) {
    throw new Error('MCP_SERVER_URL must not contain a query string or fragment')
  }
  if (serverUrl.pathname !== '/api/mcp') {
    throw new Error('MCP_SERVER_URL must use the /api/mcp path')
  }

  const allowedOriginHostnames = environment.MCP_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).hostname)

  return {
    serverUrl,
    issuer,
    audience: environment.MCP_OAUTH_AUDIENCE ?? serverUrl.toString(),
    scope: environment.MCP_OAUTH_SCOPE,
    allowedHostnames: [serverUrl.hostname],
    allowedOriginHostnames: allowedOriginHostnames ?? [],
    dangerouslyAllowInsecureUrls: isLoopback(serverUrl) && isLoopback(issuer),
  }
}

export function getMcpConfig() {
  return resolveMcpConfig(getServerEnv())
}
