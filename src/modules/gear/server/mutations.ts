import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  deleteEquipment,
  deleteGearSet,
  gearSetInputSchema,
  saveEquipment,
  saveGearSet,
} from './mutations.server'

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])
const editorValueSchema = z.union([z.string(), z.boolean()])

export const saveEquipmentRecord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      recordId: recordIdSchema,
      values: z.record(z.string(), editorValueSchema),
    }),
  )
  .handler(async ({ data }) => ({ id: await saveEquipment(data.recordId, data.values) }))

export const deleteEquipmentRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deleteEquipment(data.recordId)
  })

export const saveGearSetRecord = createServerFn({ method: 'POST' })
  .validator(gearSetInputSchema)
  .handler(({ data }) => saveGearSet(data))

export const deleteGearSetRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(({ data }) => deleteGearSet(data.id))
