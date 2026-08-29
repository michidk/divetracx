import { createFileRoute } from '@tanstack/react-router'
import { getDives } from '@/modules/dives/server/queries'
import { DiveList } from './-components/dive-list'

export const Route = createFileRoute('/dives/')({
  loader: () => getDives(),
  component: DivesRoute,
})

function DivesRoute() {
  return <DiveList dives={Route.useLoaderData()} />
}
