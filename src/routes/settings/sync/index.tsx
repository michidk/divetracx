import { createFileRoute } from '@tanstack/react-router'
import { getIntegrationStatus } from '@/modules/integrations/server/operations'
import { SyncPage } from './-components/sync-page'

export const Route = createFileRoute('/settings/sync/')({
  loader: () => getIntegrationStatus(),
  component: SyncRoute,
})

function SyncRoute() {
  return <SyncPage integrations={Route.useLoaderData()} />
}
