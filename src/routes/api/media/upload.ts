import { createFileRoute } from '@tanstack/react-router'
import { handlePhotoUpload } from '@/modules/media/server/upload.server'

export const Route = createFileRoute('/api/media/upload')({
  server: {
    handlers: {
      POST: ({ request }) => handlePhotoUpload(request),
    },
  },
})
