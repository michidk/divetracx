import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadDashboard, loadDive, loadDives } from './queries.server'

export const getDashboard = createServerFn({ method: 'GET' }).handler(loadDashboard)

export const getDives = createServerFn({ method: 'GET' }).handler(loadDives)

export const getDive = createServerFn({ method: 'GET' })
  .validator(z.object({ diveId: z.string().uuid() }))
  .handler(({ data }) => loadDive(data.diveId))
