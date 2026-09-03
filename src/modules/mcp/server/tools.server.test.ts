import { describe, expect, test } from 'bun:test'
import { createMcpHandler } from '@modelcontextprotocol/server'
import type { McpToolAccess } from './tools.server'
import { createDivetracxMcpServer, type McpLoaders } from './tools.server'

function parseMcpResponse(body: string) {
  const data = body
    .split('\n')
    .find((line) => line.startsWith('data: '))
    ?.slice('data: '.length)
  if (!data) throw new Error('MCP response did not contain an SSE data event')
  return JSON.parse(data)
}

function createTestHandler(loaders: McpLoaders, access?: McpToolAccess) {
  return createMcpHandler(() => createDivetracxMcpServer(loaders, access))
}

async function postMcp(handler: ReturnType<typeof createTestHandler>, body: unknown) {
  const response = await handler.fetch(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  )
  expect(response.status).toBe(200)
  return parseMcpResponse(await response.text())
}

const emptyLoaders = {
  loadDives: async () => ({
    records: [],
    total: 0,
    page: 1,
    pageCount: 1,
    pageSize: 50,
  }),
  loadDive: async () => null,
  loadStatistics: async () => ({ calendarDives: [] }),
  loadSitesOverview: async () => [],
} as unknown as McpLoaders

describe('Divetracx MCP tools', () => {
  test('advertises bounded read tools for a read-only token', async () => {
    const message = await postMcp(createTestHandler(emptyLoaders), {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    })

    expect(message.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'search_dives',
      'get_dive',
      'list_dive_sites',
      'get_diving_statistics',
      'list_buddies',
      'get_buddy',
      'list_gear',
      'get_gear_item',
      'get_profile',
      'get_dive_editor_options',
    ])
    for (const tool of message.result.tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      })
    }
  })

  test('registers write and delete tools only when both scope and policy allow them', async () => {
    let created: unknown
    const loaders = {
      ...emptyLoaders,
      createDive: async (input: unknown) => {
        created = input
        return '1891d7b6-d89d-44af-8bc5-39db03489cd4'
      },
    } as McpLoaders
    const access: McpToolAccess = {
      scopes: ['divetracx:read', 'divetracx:write', 'divetracx:delete'],
      enabledTools: ['search_dives', 'create_dive', 'delete_dive'],
    }
    const handler = createTestHandler(loaders, access)
    const list = await postMcp(handler, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
      params: {},
    })

    expect(list.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'search_dives',
      'create_dive',
      'delete_dive',
    ])
    expect(list.result.tools[1].annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    })
    expect(list.result.tools[2].annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    })

    const result = await postMcp(handler, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'create_dive',
        arguments: { diveDate: '2026-09-03', maximumDepthMeters: 18.5 },
      },
    })
    expect(created).toMatchObject({ diveDate: '2026-09-03', maximumDepthMeters: 18.5 })
    expect(result.result.structuredContent).toEqual({
      id: '1891d7b6-d89d-44af-8bc5-39db03489cd4',
    })
  })

  test('passes validated search arguments to the dive query', async () => {
    let received: [string, number] | undefined
    const loaders = {
      ...emptyLoaders,
      loadDives: async (query: string, page: number) => {
        received = [query, page]
        return { records: [], total: 0, page, pageCount: 1, pageSize: 50 }
      },
    } as McpLoaders

    const message = await postMcp(createTestHandler(loaders), {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search_dives',
        arguments: { query: 'Maldives', page: 2 },
      },
    })

    expect(received).toEqual(['Maldives', 2])
    expect(message.result.structuredContent).toMatchObject({ total: 0, page: 2 })
  })
})
