import { createFileRoute } from '@tanstack/react-router'
import { ExportPage } from './-components/export-page'

export const Route = createFileRoute('/settings/export/')({
  component: ExportRoute,
})

function ExportRoute() {
  return <ExportPage />
}
