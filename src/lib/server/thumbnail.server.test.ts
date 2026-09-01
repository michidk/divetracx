import { describe, expect, test } from 'bun:test'
import { createThumbnail } from './thumbnail.server'

describe('createThumbnail', () => {
  test('creates a separate WebP derivative', async () => {
    const original = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    )

    const thumbnail = await createThumbnail(original)

    expect(new TextDecoder().decode(thumbnail.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(thumbnail.slice(8, 12))).toBe('WEBP')
    expect(original[0]).toBe(0x89)
  })
})
