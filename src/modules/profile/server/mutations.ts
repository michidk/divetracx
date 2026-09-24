import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { saveDiver } from './mutations.server'

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])
const editorValueSchema = z.union([z.string(), z.boolean()])

export const saveDiverRecord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      recordId: recordIdSchema,
      values: z.record(z.string(), editorValueSchema),
    }),
  )
  .handler(async ({ data }) => ({ id: await saveDiver(data.recordId, data.values) }))
