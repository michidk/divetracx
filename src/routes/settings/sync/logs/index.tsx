import { createFileRoute } from '@tanstack/react-router'
import { getImportLogs } from '@/modules/integrations/server/operations'
import { SyncLogsPage } from './-components/sync-logs-page'

export const Route = createFileRoute('/settings/sync/logs/')({
  loader: () => getImportLogs(),
  component: SyncLogsRoute,
})

function SyncLogsRoute() {
  return <SyncLogsPage logs={Route.useLoaderData()} />
}
