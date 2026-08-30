import { createFileRoute } from '@tanstack/react-router'
import { getDiveSiteMap } from '@/modules/dives/server/queries'
import { MapPage } from './-components/map-page'

export const Route = createFileRoute('/map/')({
  loader: () => getDiveSiteMap(),
  head: () => ({
    meta: [{ title: 'Dive spots · Divetracx' }],
  }),
  component: MapRoute,
})

function MapRoute() {
  return <MapPage sites={Route.useLoaderData()} />
}
