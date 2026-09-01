import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadBuddiesOverview, loadBuddyDetail } from './queries.server'

export const getBuddies = createServerFn({ method: 'GET' }).handler(loadBuddiesOverview)

export const getBuddy = createServerFn({ method: 'GET' })
  .validator(z.object({ buddyId: z.string().uuid() }))
  .handler(({ data }) => loadBuddyDetail(data.buddyId))
