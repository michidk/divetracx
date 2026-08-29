import { createServerFn } from '@tanstack/react-start'
import { loadSyncLogs } from './logs.server'

export const getDiveMateSyncLogs = createServerFn({ method: 'GET' }).handler(loadSyncLogs)
