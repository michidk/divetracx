import type { Register } from '@tanstack/react-router'
import type { RequestHandler } from '@tanstack/react-start/server'
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { injectHeadHtml } from '@/lib/head-html.server'
import { publicEnv } from '@/lib/public-env'
import { handleMcpHttpRequest } from '@/modules/mcp/server/http.server'

const startHandler = createStartHandler(defaultStreamHandler)

const fetch: RequestHandler<Register> = async (request, options) => {
  const mcpResponse = await handleMcpHttpRequest(request)
  if (mcpResponse) return mcpResponse

  const response = await startHandler(request, options)
  return injectHeadHtml(response, publicEnv.VITE_HEAD_HTML)
}

export default { fetch }
