import '@tanstack/react-start/server-only'

import { defineHandler } from 'nitro'
import { getStorage } from '@/lib/storage'

const CONTENT_TYPES: Record<string, string> = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export default defineHandler(async (event) => {
  const url = new URL(event.req.url)
  let path: string
  try {
    path = url.pathname
      .slice('/media/'.length)
      .split('/')
      .map(decodeURIComponent)
      .join('/')
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  if (!path || path.includes('..') || path.startsWith('/')) {
    return new Response('Forbidden', { status: 403 })
  }

  const storage = getStorage()
  if (!(await storage.exists(path))) return new Response('Not found', { status: 404 })
  const blob = await storage.download(path)
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return new Response(blob, {
    headers: {
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Type': blob.type || CONTENT_TYPES[extension] || 'application/octet-stream',
      Vary: 'Cookie, Authorization',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
