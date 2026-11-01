import { expect, test } from 'bun:test'
import { resolveMcpConfig } from './config.server'

test('private MCP needs no signing secret and only permits configured hosts', () => {
  const config = resolveMcpConfig({
    MCP_ALLOWED_HOSTS: 'divetracx-mcp.divetracx.svc.cluster.local',
    MCP_ALLOWED_ORIGINS: 'https://client.internal',
  })
  expect(config.allowedHostnames).toContain('localhost')
  expect(config.allowedHostnames).toContain('divetracx-mcp.divetracx.svc.cluster.local')
  expect(config.allowedHostnames).not.toContain('dives.example.com')
  expect(config.allowedOrigins).toContain('client.internal')
})
