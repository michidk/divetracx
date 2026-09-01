import { createFileRoute } from '@tanstack/react-router'
import { getStatistics } from '@/modules/dives/server/stats'
import { StatsPage } from './-components/stats-page'

export const Route = createFileRoute('/stats/')({
  loader: () => getStatistics(),
  component: StatsRoute,
})

function StatsRoute() {
  return <StatsPage data={Route.useLoaderData()} />
}
