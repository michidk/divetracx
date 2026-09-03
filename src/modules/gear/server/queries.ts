import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadGearDetail, loadGearOverview, loadGearSetEditor } from './queries.server'

export const getGear = createServerFn({ method: 'GET' }).handler(loadGearOverview)

export const getGearItem = createServerFn({ method: 'GET' })
  .validator(z.object({ gearId: z.string().uuid() }))
  .handler(({ data }) => loadGearDetail(data.gearId))

export const getGearSetEditor = createServerFn({ method: 'GET' })
  .validator(z.object({ gearSetId: z.string().uuid().nullable() }))
  .handler(({ data }) => loadGearSetEditor(data.gearSetId))
