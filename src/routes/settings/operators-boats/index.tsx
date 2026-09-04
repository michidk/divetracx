import { createFileRoute } from '@tanstack/react-router'
import { getOperatorsAndBoats } from '@/modules/dives/server/operators-boats'
import { OperatorsBoatsPage } from './-components/operators-boats-page'

export const Route = createFileRoute('/settings/operators-boats/')({
  loader: () => getOperatorsAndBoats(),
  head: () => ({
    meta: [{ title: 'Dive operators & boats · Settings · Divetracx' }],
  }),
  component: OperatorsBoatsRoute,
})

function OperatorsBoatsRoute() {
  return <OperatorsBoatsPage data={Route.useLoaderData()} />
}
