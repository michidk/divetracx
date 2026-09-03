import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { deleteGearSet, gearSetInputSchema, saveGearSet } from './mutations.server'

export const saveGearSetRecord = createServerFn({ method: 'POST' })
  .validator(gearSetInputSchema)
  .handler(({ data }) => saveGearSet(data))

export const deleteGearSetRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(({ data }) => deleteGearSet(data.id))
