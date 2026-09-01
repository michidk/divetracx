import { createFileRoute } from '@tanstack/react-router'
import { getGear } from '@/modules/gear/server/queries'
import { GearPage } from './-components/gear-page'

export const Route = createFileRoute('/gear/')({
  loader: () => getGear(),
  head: () => ({ meta: [{ title: 'Gear · Divetracx' }] }),
  component: GearRoute,
})

function GearRoute() {
  return <GearPage gear={Route.useLoaderData()} />
}
