import '@tanstack/react-start/server-only'

export type ThumbnailUse = 'photo' | 'certification' | 'profile'

export const THUMBNAIL_PROFILES = {
  photo: {
    width: 1280,
    height: 1280,
    quality: 78,
  },
  certification: {
    width: 856,
    height: 540,
    quality: 80,
  },
  profile: {
    width: 720,
    height: 720,
    quality: 84,
  },
} as const satisfies Record<
  ThumbnailUse,
  { width: number; height: number; quality: number }
>

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

export function thumbnailPathFor(storagePath: string) {
  const slash = storagePath.lastIndexOf('/')
  const dot = storagePath.lastIndexOf('.')
  const stem = dot > slash ? storagePath.slice(0, dot) : storagePath
  return `${stem}.thumb.webp`
}

export async function createThumbnail(
  bytes: Uint8Array,
  use: ThumbnailUse = 'photo',
): Promise<Uint8Array> {
  const sharp = await loadSharp()
  const profile = THUMBNAIL_PROFILES[use]
  const pipeline = sharp(Buffer.from(bytes))
    .rotate()
    .resize({
      width: profile.width,
      height: profile.height,
      fit: use === 'profile' ? 'cover' : 'inside',
      withoutEnlargement: true,
    })
  const thumbnail = await pipeline
    .clone()
    .webp({ quality: profile.quality, effort: 4, smartSubsample: true })
    .toBuffer()
  if (thumbnail.byteLength < bytes.byteLength) return thumbnail

  const compactThumbnail = await pipeline
    .webp({ quality: 72, effort: 4, smartSubsample: true })
    .toBuffer()
  return compactThumbnail.byteLength < thumbnail.byteLength ? compactThumbnail : thumbnail
}
