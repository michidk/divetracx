import { describe, expect, test } from 'bun:test'
import { resolveMcpConfig } from './config.server'

describe('MCP configuration', () => {
  test('is disabled without a public server URL', () => {
    expect(resolveMcpConfig({ HODOR_SECRET: 'x'.repeat(64) })).toBeNull()
  })

  test('derives the built-in issuer and requires owner-session verification', () => {
    expect(
      resolveMcpConfig({
        MCP_SERVER_URL: 'https://dives.example.com/api/mcp',
        HODOR_SECRET: 'x'.repeat(64),
        MCP_ALLOWED_ORIGINS: 'https://chatgpt.com, https://example.test/path',
      }),
    ).toMatchObject({
      issuer: new URL('https://dives.example.com/'),
      allowedOrigins: ['https://chatgpt.com', 'https://example.test'],
    })
    expect(() =>
      resolveMcpConfig({ MCP_SERVER_URL: 'https://dives.example.com/api/mcp' }),
    ).toThrow('HODOR_SECRET')
  })

  test('rejects insecure public and non-canonical MCP URLs', () => {
    expect(() =>
      resolveMcpConfig({
        MCP_SERVER_URL: 'http://dives.example.com/api/mcp',
        HODOR_SECRET: 'x'.repeat(64),
      }),
    ).toThrow('HTTPS')
    expect(() =>
      resolveMcpConfig({
        MCP_SERVER_URL: 'https://dives.example.com/mcp',
        HODOR_SECRET: 'x'.repeat(64),
      }),
    ).toThrow('/api/mcp')
  })
})
