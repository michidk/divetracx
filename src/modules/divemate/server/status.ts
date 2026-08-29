import { createServerFn } from '@tanstack/react-start'
import { loadSyncStatus } from './status.server'

export const getDiveMateSyncStatus = createServerFn({ method: 'GET' }).handler(
  loadSyncStatus,
)
