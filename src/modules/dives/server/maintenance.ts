import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { savePriorDiveCount } from './logbook-settings.server'
import { loadDataVerificationStatus, renumberDivesByDate } from './maintenance.server'

export const getDataVerificationStatus = createServerFn({ method: 'GET' }).handler(
  loadDataVerificationStatus,
)

export const renumberDives = createServerFn({ method: 'POST' }).handler(
  renumberDivesByDate,
)

export const updatePriorDiveCount = createServerFn({ method: 'POST' })
  .validator(z.object({ priorDiveCount: z.number().int().min(0).max(100_000) }))
  .handler(({ data }) => savePriorDiveCount(data.priorDiveCount))
