import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { entityKeySchema } from '../entities'
import { saveDataRecord } from './mutations.server'
import { loadDataEditor, loadDataList, loadDataOverview } from './records.server'

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])
const editorValueSchema = z.union([z.string(), z.boolean(), z.array(z.string())])

export const getDataOverview = createServerFn({ method: 'GET' }).handler(loadDataOverview)

export const getDataList = createServerFn({ method: 'GET' })
  .validator(z.object({ entity: entityKeySchema }))
  .handler(({ data }) => loadDataList(data.entity))

export const getDataEditor = createServerFn({ method: 'GET' })
  .validator(z.object({ entity: entityKeySchema, recordId: recordIdSchema }))
  .handler(({ data }) => loadDataEditor(data.entity, data.recordId))

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
