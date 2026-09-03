import { createFileRoute } from '@tanstack/react-router'
import { getDiveTypes } from '@/modules/dives/server/dive-types'
import { DiveTypesPage } from './-components/dive-types-page'

export const Route = createFileRoute('/settings/dive-types/')({
  loader: () => getDiveTypes(),
  head: () => ({ meta: [{ title: 'Dive types · Settings · Divetracx' }] }),
  component: DiveTypesRoute,
})

function DiveTypesRoute() {
  return <DiveTypesPage diveTypes={Route.useLoaderData()} />
}
