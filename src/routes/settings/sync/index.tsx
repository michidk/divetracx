import { createFileRoute } from '@tanstack/react-router'
import { getGarminAccountStatus } from '@/modules/garmin/server/account'
import { getIntegrationStatus } from '@/modules/integrations/server/operations'
import { SyncPage } from './-components/sync-page'

export const Route = createFileRoute('/settings/sync/')({
  loader: async () => {
    const [integrations, garminAccount] = await Promise.all([
      getIntegrationStatus(),
      getGarminAccountStatus(),
    ])
    return { integrations, garminAccount }
  },
  component: SyncRoute,
})

function SyncRoute() {
  const { integrations, garminAccount } = Route.useLoaderData()
  return <SyncPage integrations={integrations} garminAccount={garminAccount} />
}
