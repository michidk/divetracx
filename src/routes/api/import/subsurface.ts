import { createFileRoute } from '@tanstack/react-router'
import { handleSubsurfaceUpload } from '@/modules/subsurface/server/upload.server'

export const Route = createFileRoute('/api/import/subsurface')({
  server: {
    handlers: {
      POST: ({ request }) => handleSubsurfaceUpload(request),
    },
  },
})
