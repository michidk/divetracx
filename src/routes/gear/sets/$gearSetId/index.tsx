import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { getGearSetEditor } from '@/modules/gear/server/queries'
import { GearSetPage } from './-components/gear-set-page'

const gearSetIdSchema = z.string().uuid()

export const Route = createFileRoute('/gear/sets/$gearSetId/')({
  loader: async ({ params }) => {
    const gearSetId = gearSetIdSchema.safeParse(params.gearSetId)
    if (!gearSetId.success) throw notFound()
    const data = await getGearSetEditor({ data: { gearSetId: gearSetId.data } })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.set
          ? `${loaderData.set.name} · Gear sets · Divetracx`
          : 'Gear set · Divetracx',
      },
    ],
  }),
  component: GearSetRoute,
})

function GearSetRoute() {
  return <GearSetPage data={Route.useLoaderData()} />
}
