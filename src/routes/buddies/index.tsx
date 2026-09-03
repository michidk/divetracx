import { createFileRoute } from '@tanstack/react-router'
import { getBuddies } from '@/modules/buddies/server/queries'
import { BuddiesPage } from './-components/buddies-page'

export const Route = createFileRoute('/buddies/')({
  loader: () => getBuddies(),
  head: () => ({ meta: [{ title: 'Buddies · Divetracx' }] }),
  component: BuddiesRoute,
})

function BuddiesRoute() {
  return <BuddiesPage buddies={Route.useLoaderData()} />
}
