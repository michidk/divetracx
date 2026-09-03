import { createServerFn } from '@tanstack/react-start'
import { getDiveMateWriteBackStatus, startDiveMateWriteBack } from './writeback.server'

export const runDiveMateWriteBack = createServerFn({ method: 'POST' }).handler(() =>
  startDiveMateWriteBack(),
)

export const loadDiveMateWriteBackStatus = createServerFn({ method: 'GET' }).handler(() =>
  getDiveMateWriteBackStatus(),
)
