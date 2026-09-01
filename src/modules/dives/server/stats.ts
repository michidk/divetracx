import { createServerFn } from '@tanstack/react-start'
import { loadStatistics } from './stats.server'

export const getStatistics = createServerFn({ method: 'GET' }).handler(loadStatistics)
