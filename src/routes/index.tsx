import { createFileRoute } from '@tanstack/react-router'
import { getDashboard } from '@/modules/dives/server/queries'
import { OverviewPage } from './-components/overview-page'

export const Route = createFileRoute('/')({
  loader: () => getDashboard(),
  component: OverviewRoute,
})

function OverviewRoute() {
  return <OverviewPage data={Route.useLoaderData()} />
}
