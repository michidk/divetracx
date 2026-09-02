import { createFileRoute } from '@tanstack/react-router'
import { getAgencies } from '@/modules/profile/server/agencies'
import { AgenciesPage } from './-components/agencies-page'

export const Route = createFileRoute('/settings/agencies/')({
  loader: () => getAgencies(),
  head: () => ({ meta: [{ title: 'Agencies · Settings · Divetracx' }] }),
  component: AgenciesRoute,
})

function AgenciesRoute() {
  return <AgenciesPage agencies={Route.useLoaderData()} />
}
