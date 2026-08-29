import { createFileRoute } from '@tanstack/react-router'
import { getDataOverview } from '@/modules/data/server/records'
import { DataOverviewPage } from './-components/data-overview-page'

export const Route = createFileRoute('/data/')({
  loader: () => getDataOverview(),
  component: DataRoute,
})

function DataRoute() {
  return <DataOverviewPage counts={Route.useLoaderData()} />
}
