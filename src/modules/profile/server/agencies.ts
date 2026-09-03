import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createCustomAgency, deleteCustomAgency, loadAgencies } from './agencies.server'

export const getAgencies = createServerFn({ method: 'GET' }).handler(() => loadAgencies())

export const addCustomAgency = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().max(120),
      websiteUrl: z.string().max(2_048).optional(),
      loginUrl: z.string().max(2_048).optional(),
    }),
  )
  .handler(({ data }) => createCustomAgency(data))

export const removeCustomAgency = createServerFn({ method: 'POST' })
  .validator(z.object({ agencyId: z.string().uuid() }))
  .handler(({ data }) => deleteCustomAgency(data.agencyId))
