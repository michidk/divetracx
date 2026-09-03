import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  loadBuddiesOverview,
  loadBuddyAgencyMembership,
  loadBuddyCertification,
  loadBuddyDetail,
} from './queries.server'

export const getBuddies = createServerFn({ method: 'GET' }).handler(loadBuddiesOverview)

export const getBuddy = createServerFn({ method: 'GET' })
  .validator(z.object({ buddyId: z.string().uuid() }))
  .handler(({ data }) => loadBuddyDetail(data.buddyId))

export const getBuddyCertification = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      buddyId: z.string().uuid(),
      buddyCertificationId: z.string().uuid(),
    }),
  )
  .handler(({ data }) => loadBuddyCertification(data.buddyId, data.buddyCertificationId))

export const getBuddyAgencyMembership = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      buddyId: z.string().uuid(),
      buddyAgencyMembershipId: z.string().uuid(),
    }),
  )
  .handler(({ data }) =>
    loadBuddyAgencyMembership(data.buddyId, data.buddyAgencyMembershipId),
  )
