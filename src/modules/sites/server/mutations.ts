import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { deleteSite, saveSite } from './mutations.server'

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])
const editorValueSchema = z.union([z.string(), z.boolean()])

export const saveSiteRecord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      recordId: recordIdSchema,
      values: z.record(z.string(), editorValueSchema),
    }),
  )
  .handler(async ({ data }) => ({ id: await saveSite(data.recordId, data.values) }))

export const deleteSiteRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deleteSite(data.recordId)
  })
