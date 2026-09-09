import { createFileRoute } from '@tanstack/react-router'
import { getDataVerificationStatus } from '@/modules/dives/server/maintenance'
import { DataVerificationPage } from './-components/data-verification-page'

export const Route = createFileRoute('/settings/data-verification/')({
  loader: () => getDataVerificationStatus(),
  head: () => ({ meta: [{ title: 'Data verification · Divetracx' }] }),
  component: DataVerificationRoute,
})

function DataVerificationRoute() {
  return <DataVerificationPage status={Route.useLoaderData()} />
}
