import { describe, expect, test } from 'bun:test'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { createDivetracxMcpServer, type McpLoaders } from './tools.server'

function parseMcpResponse(body: string) {
  const data = body
    .split('\n')
    .find((line) => line.startsWith('data: '))
    ?.slice('data: '.length)
  if (!data) throw new Error('MCP response did not contain an SSE data event')
  return JSON.parse(data)
}

function createTestHandler(loaders: McpLoaders) {
  return createMcpHandler(() => createDivetracxMcpServer(loaders))
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
  test('advertises only bounded read-only tools', async () => {
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
