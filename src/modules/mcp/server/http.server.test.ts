import { expect, test } from 'bun:test'
import { resolveMcpConfig } from './config.server'
import { createMcpHttpHandler, handlesMcpHttpPath } from './http.server'

const config = resolveMcpConfig({ MCP_ALLOWED_HOSTS: 'divetracx.internal' })
function request(method = 'initialize', host = 'divetracx.internal', origin?: string) {
  return new Request('http://upstream/api/mcp', {
    method: 'POST',
    headers: {
      Host: host,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params:
        method === 'initialize'
          ? {
              protocolVersion: '2025-03-26',
              capabilities: {},
              clientInfo: { name: 'test', version: '1' },
            }
          : {},
    }),
  })
}

test('stateless private MCP initializes and discovers tools without OAuth', async () => {
  const handle = createMcpHttpHandler(config)
  const response = await handle(request())
  expect(response?.status).toBe(200)
  expect(response?.headers.get('www-authenticate')).toBeNull()
  expect(response?.headers.get('mcp-session-id')).toBeNull()
  const tools = await handle(request('tools/list'))
  expect(tools?.status).toBe(200)
  expect(await tools?.text()).toContain('search_dives')
  for (const path of [
    '/oauth/register',
    '/oauth/token',
    '/oauth/authorize',
    '/.well-known/oauth-authorization-server',
  ]) {
    expect(handlesMcpHttpPath(path)).toBe(false)
    expect(await handle(new Request(`http://localhost${path}`))).toBeNull()
  }
})

test('private MCP rejects unknown hosts, browser origins and paused access', async () => {
  const handle = createMcpHttpHandler(config)
  expect((await handle(request('initialize', 'evil.example')))?.status).toBe(403)
  expect(
    (await handle(request('initialize', 'divetracx.internal', 'https://evil.example')))
      ?.status,
  ).toBe(403)
  const paused = createMcpHttpHandler(config, {
    policy: async () => ({ enabled: false, disabledTools: [] }),
  })
  expect((await paused(request()))?.status).toBe(503)
})

test('disabled tools disappear on the next stateless request', async () => {
  const handle = createMcpHttpHandler(config, {
    policy: async () => ({ enabled: true, disabledTools: ['search_dives'] }),
  })
  const response = await handle(request('tools/list'))
  expect(response?.status).toBe(200)
  expect(await response?.text()).not.toContain('"name":"search_dives"')
})
