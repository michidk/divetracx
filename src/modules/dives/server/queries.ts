import { createServerFn } from '@tanstack/react-start'
import { loadDashboard, loadDives } from './queries.server'

export const getDashboard = createServerFn({ method: 'GET' }).handler(loadDashboard)

export const getDives = createServerFn({ method: 'GET' }).handler(loadDives)
