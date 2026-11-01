import '@tanstack/react-start/server-only'

import {
  createMcpHandler,
  hostHeaderValidationResponse,
  originValidationResponse,
} from '@modelcontextprotocol/server'
import { z } from 'zod'
import { MCP_SCOPE_VALUES, MCP_TOOL_CATALOG } from '@/modules/mcp/catalog'
import { getMcpConfig, type McpConfig } from './config.server'
import { loadMcpPolicy, type McpPolicy, recordMcpAudit } from './settings.server'
import { createDivetracxMcpServer, type McpLoaders } from './tools.server'

export function handlesMcpHttpPath(pathname: string) {
  return pathname === '/api/mcp'
}

const toolCall = z.object({
  method: z.literal('tools/call'),
  params: z.object({ name: z.string().max(200) }),
})

export function createMcpHttpHandler(
  config: McpConfig,
  options: {
    policy?: () => Promise<McpPolicy>
    audit?: typeof recordMcpAudit
    loaders?: McpLoaders
  } = {},
) {
  const loadPolicy =
    options.policy ??
    (async (): Promise<McpPolicy> => ({ enabled: true, disabledTools: [] }))
  const protocol = createMcpHandler(async () => {
    const policy = await loadPolicy()
    return createDivetracxMcpServer(options.loaders, {
      scopes: [...MCP_SCOPE_VALUES],
      enabledTools: MCP_TOOL_CATALOG.filter(
        (tool) => !policy.disabledTools.includes(tool.name),
      ).map((tool) => tool.name),
    })
  })
  return async (request: Request): Promise<Response | null> => {
    if (!handlesMcpHttpPath(new URL(request.url).pathname)) return null
    const rejected =
      hostHeaderValidationResponse(request, config.allowedHostnames) ??
      originValidationResponse(request, config.allowedOrigins)
    if (rejected) return rejected
    if (!(await loadPolicy()).enabled)
      return Response.json({ error: 'mcp_disabled' }, { status: 503 })
    const call =
      request.method === 'POST'
        ? toolCall.safeParse(
            await request
              .clone()
              .json()
              .catch(() => null),
          )
        : null
    try {
      const response = await protocol.fetch(request)
      if (call?.success)
        await options.audit?.(call.data.params.name, response.ok ? 'success' : 'failure')
      return response
    } catch (error) {
      if (call?.success) await options.audit?.(call.data.params.name, 'failure')
      throw error
    }
  }
}

let liveHandler: ReturnType<typeof createMcpHttpHandler> | undefined
export async function handleMcpHttpRequest(request: Request): Promise<Response | null> {
  if (!handlesMcpHttpPath(new URL(request.url).pathname)) return null
  try {
    liveHandler ??= createMcpHttpHandler(getMcpConfig(), {
      policy: loadMcpPolicy,
      audit: recordMcpAudit,
    })
    return await liveHandler(request)
  } catch (error) {
    console.error('MCP request failed', error)
    return Response.json({ error: 'server_error' }, { status: 503 })
  }
}
