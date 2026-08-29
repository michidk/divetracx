import { createFileRoute } from '@tanstack/react-router'
import { getDiveMateSyncStatus } from '@/modules/divemate/server/status'
import { SyncPage } from './-components/sync-page'

export const Route = createFileRoute('/settings/sync/')({
  loader: () => getDiveMateSyncStatus(),
  component: SyncRoute,
})

function SyncRoute() {
  return <SyncPage status={Route.useLoaderData()} />
}
