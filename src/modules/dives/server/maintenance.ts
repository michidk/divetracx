import { createServerFn } from '@tanstack/react-start'
import { loadDataVerificationStatus, renumberDivesByDate } from './maintenance.server'

export const getDataVerificationStatus = createServerFn({ method: 'GET' }).handler(
  loadDataVerificationStatus,
)

export const renumberDives = createServerFn({ method: 'POST' }).handler(
  renumberDivesByDate,
)
