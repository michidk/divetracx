import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadSiteDetail, loadSitesOverview } from './queries.server'

export const getSites = createServerFn({ method: 'GET' }).handler(loadSitesOverview)

export const getSite = createServerFn({ method: 'GET' })
  .validator(z.object({ siteId: z.string().uuid() }))
  .handler(({ data }) => loadSiteDetail(data.siteId))
