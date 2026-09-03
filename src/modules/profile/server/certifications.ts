import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { updateCertificationCardFeature } from './certifications.server'

export const setCertificationCardFeature = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      certificationId: z.string().uuid(),
      featured: z.boolean(),
    }),
  )
  .handler(({ data }) => updateCertificationCardFeature(data))
