import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { getGearItem } from '@/modules/gear/server/queries'
import { GearItemPage } from './-components/gear-item-page'

const gearIdSchema = z.string().uuid()

export const Route = createFileRoute('/gear/$gearId/')({
  loader: async ({ params }) => {
    const gearId = gearIdSchema.safeParse(params.gearId)
    if (!gearId.success) throw notFound()
    const detail = await getGearItem({ data: { gearId: gearId.data } })
    if (!detail) throw notFound()
    return detail
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.item.name} · Divetracx` : 'Gear · Divetracx',
      },
    ],
  }),
  component: GearItemRoute,
})

function GearItemRoute() {
  const detail = Route.useLoaderData()
  return <GearItemPage key={detail.item.id} detail={detail} />
}
