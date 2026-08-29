import { createFileRoute } from '@tanstack/react-router'
import { getDiveMateSyncLogs } from '@/modules/divemate/server/logs'
import { SyncLogsPage } from './-components/sync-logs-page'

export const Route = createFileRoute('/settings/sync/logs/')({
  loader: () => getDiveMateSyncLogs(),
  component: SyncLogsRoute,
})

function SyncLogsRoute() {
  return <SyncLogsPage logs={Route.useLoaderData()} />
}
