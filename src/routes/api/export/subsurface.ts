import { createFileRoute } from '@tanstack/react-router'
import { exportResponse } from '@/modules/export/server/files.server'

export const Route = createFileRoute('/api/export/subsurface')({
  server: {
    handlers: {
      GET: () => exportResponse('subsurface'),
    },
  },
})
