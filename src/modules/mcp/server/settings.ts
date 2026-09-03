import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { mcpToolNameSchema } from '@/modules/mcp/catalog'
import { loadMcpAdminState, revokeMcpClient, saveMcpPolicy } from './settings.server'

export const getMcpAdminState = createServerFn({ method: 'GET' }).handler(() =>
  loadMcpAdminState(),
)

export const updateMcpPolicy = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      enabled: z.boolean(),
      disabledTools: z.array(mcpToolNameSchema),
    }),
  )
  .handler(({ data }) => saveMcpPolicy(data))

export const revokeMcpClientConnection = createServerFn({ method: 'POST' })
  .validator(z.object({ clientId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await revokeMcpClient(data.clientId)
  })
