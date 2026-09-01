import { createServerFn } from '@tanstack/react-start'
import { writeBackDiveMate } from './writeback.server'

export const runDiveMateWriteBack = createServerFn({ method: 'POST' }).handler(() =>
  writeBackDiveMate(),
)
