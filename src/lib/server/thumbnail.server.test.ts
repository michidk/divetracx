import { describe, expect, test } from 'bun:test'
import sharp from 'sharp'
import { createThumbnail, THUMBNAIL_PROFILES, thumbnailPathFor } from './thumbnail.server'

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

  test('sizes photos for high-density galleries and heroes', async () => {
    const original = await sharp({
      create: {
        width: 2400,
        height: 3200,
        channels: 3,
        background: '#0891b2',
      },
    })
      .jpeg()
      .toBuffer()

    const thumbnail = await createThumbnail(original, 'photo')
    const metadata = await sharp(thumbnail).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(960)
    expect(metadata.height).toBe(THUMBNAIL_PROFILES.photo.height)
  })

  test('bounds certification scans to their card surface', async () => {
    const original = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: '#0f172a',
      },
    })
      .png()
      .toBuffer()

    const thumbnail = await createThumbnail(original, 'certification')
    const metadata = await sharp(thumbnail).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(810)
    expect(metadata.height).toBe(THUMBNAIL_PROFILES.certification.height)
  })

  test('crops profile images to a square avatar', async () => {
    const original = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: '#087f8c',
      },
    })
      .jpeg()
      .toBuffer()

    const thumbnail = await createThumbnail(original, 'profile')
    const metadata = await sharp(thumbnail).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(THUMBNAIL_PROFILES.profile.width)
    expect(metadata.height).toBe(THUMBNAIL_PROFILES.profile.height)
  })

  test('uses stronger compression when WebP overhead exceeds a small original', async () => {
    const width = 400
    const height = 254
    const pixels = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 3
        const value = ((x * 17 + y * 31) ^ (x * y)) & 255
        pixels[offset] = value
        pixels[offset + 1] = (value * 3) & 255
        pixels[offset + 2] = (value * 7) & 255
      }
    }
    const original = await sharp(pixels, {
      raw: { width, height, channels: 3 },
    })
      .jpeg({ quality: 20 })
      .toBuffer()
    const defaultQuality = await sharp(original)
      .webp({ quality: THUMBNAIL_PROFILES.certification.quality, effort: 4 })
      .toBuffer()

    const thumbnail = await createThumbnail(original, 'certification')

    expect(thumbnail.byteLength).toBeLessThan(defaultQuality.byteLength)
  })

  test('derives a thumbnail beside its immutable original', () => {
    expect(thumbnailPathFor('uploads/dives/photo.jpeg')).toBe(
      'uploads/dives/photo.thumb.webp',
    )
    expect(thumbnailPathFor('uploads/dives/photo')).toBe('uploads/dives/photo.thumb.webp')
  })
})
