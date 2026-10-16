import '@tanstack/react-start/server-only'

import { defineHandler } from 'nitro'

export default defineHandler(async (event) => {
  const { renderProfileCard } = await import('@/modules/profile/server/card.server')
  const png = await renderProfileCard()
  const download = new URL(event.req.url).searchParams.get('download') === '1'
  return new Response(new Uint8Array(png), {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': download
        ? 'attachment; filename="divetracx-skill-card.png"'
        : 'inline',
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
