import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { getSite } from '@/modules/sites/server/queries'
import { SitePage } from './-components/site-page'

const siteIdSchema = z.string().uuid()

export const Route = createFileRoute('/sites/$siteId/')({
  loader: async ({ params }) => {
    const siteId = siteIdSchema.safeParse(params.siteId)
    if (!siteId.success) throw notFound()
    const detail = await getSite({ data: { siteId: siteId.data } })
    if (!detail) throw notFound()
    return detail
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.site.name} · Divetracx`
          : 'Dive site · Divetracx',
      },
    ],
  }),
  component: SiteRoute,
})

function SiteRoute() {
  const detail = Route.useLoaderData()
  return <SitePage key={detail.site.id} detail={detail} />
}
