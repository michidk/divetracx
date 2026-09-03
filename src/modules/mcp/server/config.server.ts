import '@tanstack/react-start/server-only'

import { getServerEnv } from '@/env'
import { MCP_SCOPE_VALUES } from '@/modules/mcp/catalog'

export const MCP_READ_SCOPE = MCP_SCOPE_VALUES[0]

export type McpConfig = {
  serverUrl: URL
  issuer: URL
  signingSecret: string
  allowedHostnames: string[]
  allowedOrigins: string[]
  dangerouslyAllowInsecureUrls: boolean
}

type McpEnvironment = {
  MCP_SERVER_URL?: string
  MCP_ALLOWED_ORIGINS?: string
  HODOR_SECRET?: string
}

function isLoopback(url: URL) {
  return ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
}

function requireSecureUrl(url: URL) {
  if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url))) {
    return
  }

  throw new Error('MCP_SERVER_URL must use HTTPS unless it targets localhost')
}

export function resolveMcpConfig(environment: McpEnvironment): McpConfig | null {
  if (!environment.MCP_SERVER_URL) return null
  if (!environment.HODOR_SECRET || environment.HODOR_SECRET.length < 32) {
    throw new Error('HODOR_SECRET must be at least 32 characters when MCP is enabled')
  }

  const serverUrl = new URL(environment.MCP_SERVER_URL)
  requireSecureUrl(serverUrl)

  if (serverUrl.search || serverUrl.hash) {
    throw new Error('MCP_SERVER_URL must not contain a query string or fragment')
  }
  if (serverUrl.pathname !== '/api/mcp') {
    throw new Error('MCP_SERVER_URL must use the /api/mcp path')
  }

  const allowedOrigins = environment.MCP_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin)

  return {
    serverUrl,
    issuer: new URL('/', serverUrl),
    signingSecret: environment.HODOR_SECRET,
    allowedHostnames: [serverUrl.hostname],
    allowedOrigins: allowedOrigins ?? [],
    dangerouslyAllowInsecureUrls: isLoopback(serverUrl),
  }
}

export function getMcpConfig() {
  return resolveMcpConfig(getServerEnv())
}
