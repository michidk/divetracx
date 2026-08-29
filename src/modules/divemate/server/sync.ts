import { createServerFn } from '@tanstack/react-start'
import { syncDiveMate } from './sync.server'

export const runDiveMateSync = createServerFn({ method: 'POST' }).handler(syncDiveMate)
