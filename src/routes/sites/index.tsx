import { createFileRoute } from '@tanstack/react-router'
import { getSites } from '@/modules/sites/server/queries'
import { SitesPage } from './-components/sites-page'

export const Route = createFileRoute('/sites/')({
  loader: () => getSites(),
  head: () => ({ meta: [{ title: 'Dive sites · Divetracx' }] }),
  component: SitesRoute,
})

function SitesRoute() {
  return <SitesPage sites={Route.useLoaderData()} />
}
