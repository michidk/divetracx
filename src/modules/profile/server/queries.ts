import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadCertification, loadProfile } from './queries.server'

export const getProfile = createServerFn({ method: 'GET' }).handler(loadProfile)

export const getCertification = createServerFn({ method: 'GET' })
  .validator(z.object({ certificationId: z.string().uuid() }))
  .handler(({ data }) => loadCertification(data.certificationId))
