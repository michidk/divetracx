import type { Register } from '@tanstack/react-router'
import type { RequestHandler } from '@tanstack/react-start/server'
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { handleMcpHttpRequest } from '@/modules/mcp/server/http.server'

const startHandler = createStartHandler(defaultStreamHandler)

const fetch: RequestHandler<Register> = async (request, options) => {
  const mcpResponse = await handleMcpHttpRequest(request)
  return mcpResponse ?? startHandler(request, options)
}

export default { fetch }
