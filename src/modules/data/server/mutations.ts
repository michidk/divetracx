import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { entityKeySchema } from '../entities'
import { saveDataRecord } from './mutations.server'

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])
const editorValueSchema = z.union([z.string(), z.boolean()])

export const saveRecord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      entity: entityKeySchema,
      recordId: recordIdSchema,
      values: z.record(z.string(), editorValueSchema),
    }),
  )
  .handler(async ({ data }) => ({
    id: await saveDataRecord(data.entity, data.recordId, data.values),
  }))
