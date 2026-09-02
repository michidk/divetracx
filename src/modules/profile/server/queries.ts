import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  loadAgencyMembership,
  loadCertification,
  loadCertificationInstructorOptions,
  loadProfile,
} from './queries.server'

export const getProfile = createServerFn({ method: 'GET' }).handler(loadProfile)

export const getCertification = createServerFn({ method: 'GET' })
  .validator(z.object({ certificationId: z.string().uuid() }))
  .handler(({ data }) => loadCertification(data.certificationId))

export const getCertificationInstructorOptions = createServerFn({
  method: 'GET',
}).handler(loadCertificationInstructorOptions)

export const getAgencyMembership = createServerFn({ method: 'GET' })
  .validator(z.object({ agencyMembershipId: z.string().uuid() }))
  .handler(({ data }) => loadAgencyMembership(data.agencyMembershipId))
