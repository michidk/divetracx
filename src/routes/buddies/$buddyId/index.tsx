import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { getBuddy } from '@/modules/buddies/server/queries'
import { BuddyPage } from './-components/buddy-page'

const buddyIdSchema = z.string().uuid()

export const Route = createFileRoute('/buddies/$buddyId/')({
  loader: async ({ params }) => {
    const buddyId = buddyIdSchema.safeParse(params.buddyId)
    if (!buddyId.success) throw notFound()
    const detail = await getBuddy({ data: { buddyId: buddyId.data } })
    if (!detail) throw notFound()
    return detail
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${[loaderData.buddy.firstName, loaderData.buddy.lastName].filter(Boolean).join(' ') || 'Buddy'} · Divetracx`
          : 'Buddy · Divetracx',
      },
    ],
  }),
  component: BuddyRoute,
})

function BuddyRoute() {
  const detail = Route.useLoaderData()
  return <BuddyPage key={detail.buddy.id} detail={detail} />
}
