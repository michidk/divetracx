import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadDiveEditor } from './editor.server'
import { loadDashboard, loadDive, loadDiveSiteMap, loadDives } from './queries.server'

export const getDashboard = createServerFn({ method: 'GET' }).handler(loadDashboard)

export const getDives = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      search: z.string().max(200).default(''),
      page: z.number().int().min(1).default(1),
    }),
  )
  .handler(({ data }) => loadDives(data.search, data.page))

export const getDiveSiteMap = createServerFn({ method: 'GET' }).handler(loadDiveSiteMap)

export const getDive = createServerFn({ method: 'GET' })
  .validator(z.object({ diveId: z.string().uuid() }))
  .handler(({ data }) => loadDive(data.diveId))

export const getDiveEditor = createServerFn({ method: 'GET' })
  .validator(z.object({ diveId: z.string().uuid().nullable() }))
  .handler(({ data }) => loadDiveEditor(data.diveId))
