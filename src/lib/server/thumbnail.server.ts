import '@tanstack/react-start/server-only'

const THUMBNAIL_WIDTH = 640
const THUMBNAIL_QUALITY = 78

type SharpFactory = typeof import('sharp').default
let sharpFactory: Promise<SharpFactory> | undefined

async function loadSharp() {
  sharpFactory ??= import('sharp').then(({ default: sharp }) => {
    sharp.cache(false)
    sharp.concurrency(1)
    return sharp
  })
  return sharpFactory
}

export async function createThumbnail(bytes: Uint8Array): Promise<Uint8Array> {
  const sharp = await loadSharp()
  return sharp(Buffer.from(bytes))
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer()
}
