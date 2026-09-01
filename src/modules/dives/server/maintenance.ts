import { createServerFn } from '@tanstack/react-start'
import { loadNumberingStatus, renumberDivesByDate } from './maintenance.server'

export const getNumberingStatus = createServerFn({ method: 'GET' }).handler(
  loadNumberingStatus,
)

export const renumberDives = createServerFn({ method: 'POST' }).handler(
  renumberDivesByDate,
)
