import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createCustomAgency, deleteCustomAgency, loadAgencies } from './agencies.server'

export const getAgencies = createServerFn({ method: 'GET' }).handler(() => loadAgencies())

export const addCustomAgency = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().max(120) }))
  .handler(({ data }) => createCustomAgency(data.name))

export const removeCustomAgency = createServerFn({ method: 'POST' })
  .validator(z.object({ agencyId: z.string().uuid() }))
  .handler(({ data }) => deleteCustomAgency(data.agencyId))
