import { createFileRoute } from '@tanstack/react-router'
import { exportFromIntegration } from '@/modules/integrations/server/operations.server'

export const Route = createFileRoute('/api/export/divemate')({
  server: {
    handlers: {
      GET: async () => {
        const file = await exportFromIntegration('divemate')
        const body =
          typeof file.body === 'string'
            ? file.body
            : new Blob([Uint8Array.from(file.body)], { type: file.contentType })
        return new Response(body, {
          headers: {
            'content-type': file.contentType,
            'content-disposition': `attachment; filename="${file.fileName.replaceAll('"', '')}"`,
            'cache-control': 'no-store',
          },
        })
      },
    },
  },
})
