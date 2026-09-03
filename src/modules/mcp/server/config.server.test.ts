import { describe, expect, test } from 'bun:test'
import { resolveMcpConfig } from './config.server'

const baseEnvironment = {
  MCP_SERVER_URL: 'https://dives.example.com/api/mcp',
  MCP_OAUTH_ISSUER: 'https://auth.example.com/realms/divetracx',
  MCP_OAUTH_SCOPE: 'divetracx:read',
}

describe('resolveMcpConfig', () => {
  test('disables MCP when neither URL is configured', () => {
    expect(resolveMcpConfig({ MCP_OAUTH_SCOPE: 'divetracx:read' })).toBeNull()
  })

  test('derives secure defaults from the public server URL', () => {
    expect(resolveMcpConfig(baseEnvironment)).toEqual({
      serverUrl: new URL('https://dives.example.com/api/mcp'),
      issuer: new URL('https://auth.example.com/realms/divetracx'),
      audience: 'https://dives.example.com/api/mcp',
      scope: 'divetracx:read',
      allowedHostnames: ['dives.example.com'],
      allowedOriginHostnames: [],
      dangerouslyAllowInsecureUrls: false,
    })
  })

  test('allows HTTP only when both endpoints are loopback URLs', () => {
    expect(
      resolveMcpConfig({
        ...baseEnvironment,
        MCP_SERVER_URL: 'http://localhost:3000/api/mcp',
        MCP_OAUTH_ISSUER: 'http://127.0.0.1:8080/realms/divetracx',
      })?.dangerouslyAllowInsecureUrls,
    ).toBe(true)
  })

  test('rejects partial, insecure, and incorrectly routed configuration', () => {
    expect(() =>
      resolveMcpConfig({
        MCP_SERVER_URL: baseEnvironment.MCP_SERVER_URL,
        MCP_OAUTH_SCOPE: 'divetracx:read',
      }),
    ).toThrow('configured together')
    expect(() =>
      resolveMcpConfig({
        ...baseEnvironment,
        MCP_SERVER_URL: 'http://dives.example.com/api/mcp',
      }),
    ).toThrow('must use HTTPS')
    expect(() =>
      resolveMcpConfig({
        ...baseEnvironment,
        MCP_SERVER_URL: 'https://dives.example.com/mcp',
      }),
    ).toThrow('/api/mcp path')
  })
})
