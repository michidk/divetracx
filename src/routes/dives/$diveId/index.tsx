import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { getDive } from '@/modules/dives/server/queries'
import { DiveNotFound, DivePage } from './-components/dive-page'

const diveIdSchema = z.string().uuid()

export const Route = createFileRoute('/dives/$diveId/')({
  loader: async ({ params }) => {
    const diveId = diveIdSchema.safeParse(params.diveId)
    if (!diveId.success) throw notFound()

    const dive = await getDive({ data: { diveId: diveId.data } })
    if (!dive) throw notFound()
    return dive
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Dive #${loaderData.number ?? '—'} · Divetracx`
          : 'Dive · Divetracx',
      },
    ],
  }),
  component: DiveRoute,
  notFoundComponent: DiveNotFound,
})

function DiveRoute() {
  return <DivePage dive={Route.useLoaderData()} />
}
