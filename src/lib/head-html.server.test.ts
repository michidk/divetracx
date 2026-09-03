import { describe, expect, test } from 'bun:test'
import { injectHeadHtml } from '@/lib/head-html.server'

describe('head HTML injection', () => {
  test('injects configured markup before a streamed closing head tag', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('<html><head><title>Divetracx</title></he'))
        controller.enqueue(encoder.encode('ad><body>Dives</body></html>'))
        controller.close()
      },
    })
    const response = new Response(body, {
      headers: {
        'content-length': '67',
        'content-type': 'text/html; charset=utf-8',
      },
    })

    const result = injectHeadHtml(
      response,
      '<script defer src="https://analytics.example/script.js"></script>',
    )

    expect(await result.text()).toBe(
      '<html><head><title>Divetracx</title><script defer src="https://analytics.example/script.js"></script></head><body>Dives</body></html>',
    )
    expect(result.headers.has('content-length')).toBe(false)
  })

  test('returns non-HTML and unconfigured responses unchanged', () => {
    const jsonResponse = Response.json({ ok: true })
    const htmlResponse = new Response('<html><head></head></html>', {
      headers: { 'content-type': 'text/html' },
    })

    expect(injectHeadHtml(jsonResponse, '<meta name="test">')).toBe(jsonResponse)
    expect(injectHeadHtml(htmlResponse)).toBe(htmlResponse)
  })
})
