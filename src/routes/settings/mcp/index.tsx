import { createFileRoute } from '@tanstack/react-router'
import { getMcpAdminState } from '@/modules/mcp/server/settings'
import { McpSettingsPage } from './-components/mcp-settings-page'

export const Route = createFileRoute('/settings/mcp/')({
  loader: () => getMcpAdminState(),
  head: () => ({ meta: [{ title: 'AI access · Divetracx' }] }),
  component: McpSettingsRoute,
})

function McpSettingsRoute() {
  return <McpSettingsPage state={Route.useLoaderData()} />
}
