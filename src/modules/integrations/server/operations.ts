import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  loadImportLogs,
  loadIntegrationStatus,
  runIntegrationImportForUi,
  saveIntegrationEntitySelection,
} from './operations.server'

const integrationKey = z.enum(['divemate', 'garmin', 'subsurface'])

export const getIntegrationStatus = createServerFn({ method: 'GET' }).handler(
  loadIntegrationStatus,
)

export const getImportLogs = createServerFn({ method: 'GET' }).handler(loadImportLogs)

export const runIncrementalImport = createServerFn({ method: 'POST' })
  .validator(z.object({ integrationKey }))
  .handler(({ data }) => runIntegrationImportForUi(data.integrationKey, 'incremental'))

export const updateIntegrationEntities = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      integrationKey,
      disabledEntities: z.array(z.string().min(1).max(64)).max(64),
    }),
  )
  .handler(({ data }) =>
    saveIntegrationEntitySelection(data.integrationKey, data.disabledEntities),
  )

export const runFullImport = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      integrationKey,
      confirmation: z.literal('REPLACE'),
    }),
  )
  .handler(({ data }) => runIntegrationImportForUi(data.integrationKey, 'full'))
