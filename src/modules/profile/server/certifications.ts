import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  deleteCertification,
  saveCertification,
  updateCertificationCardFeature,
} from './certifications.server'

export const setCertificationCardFeature = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      certificationId: z.string().uuid(),
      featured: z.boolean(),
    }),
  )
  .handler(({ data }) => updateCertificationCardFeature(data))

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])
const editorValueSchema = z.union([z.string(), z.boolean()])

export const saveCertificationRecord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      recordId: recordIdSchema,
      values: z.record(z.string(), editorValueSchema),
    }),
  )
  .handler(async ({ data }) => ({
    id: await saveCertification(data.recordId, data.values),
  }))

export const deleteCertificationRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deleteCertification(data.recordId)
  })
