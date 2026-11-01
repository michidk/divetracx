import '@tanstack/react-start/server-only'

import {
  localhostAllowedHostnames,
  localhostAllowedOrigins,
} from '@modelcontextprotocol/server'
import { getServerEnv } from '@/env'

export type McpConfig = {
  allowedHostnames: string[]
  allowedOrigins: string[]
}

type McpEnvironment = {
  MCP_ALLOWED_HOSTS?: string
  MCP_ALLOWED_ORIGINS?: string
}

function splitList(value: string | undefined) {
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  )
}

// The SDK validates Host and Origin by hostname, so accept either a bare
// hostname or a full origin URL and reduce both to the hostname.
function toHostname(entry: string) {
  return entry.includes('://') ? new URL(entry).hostname : entry.toLowerCase()
}

/**
 * Host and Origin allowlists are the DNS-rebinding defence. Requests are
 * unauthenticated, so network placement (loopback, private VPN, NetworkPolicy)
 * is what actually restricts access.
 */
export function resolveMcpConfig(environment: McpEnvironment): McpConfig {
  return {
    allowedHostnames: [
      ...new Set([
        ...localhostAllowedHostnames(),
        ...splitList(environment.MCP_ALLOWED_HOSTS).map(toHostname),
      ]),
    ],
    allowedOrigins: [
      ...new Set([
        ...localhostAllowedOrigins(),
        ...splitList(environment.MCP_ALLOWED_ORIGINS).map(toHostname),
      ]),
    ],
  }
}

export function getMcpConfig() {
  return resolveMcpConfig(getServerEnv())
}
