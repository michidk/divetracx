import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { createThumbnail, thumbnailPathFor } from '@/lib/server/thumbnail.server'
import { getStorage } from '@/lib/storage'
import type { StorageProvider } from '@/lib/storage/types'
import type { DiveMateSnapshot } from '../types'
import { findDriveFile, type openGoogleDriveBackup } from './google-drive.server'

export interface ExternalImages {
  pictures: Map<string, { bytes: Uint8Array; mimeType: string }>
  certificationScans: Map<
    string,
    {
      scan1?: { bytes: Uint8Array; mimeType: string }
      scan2?: { bytes: Uint8Array; mimeType: string }
    }
  >
}

export interface StoredImage {
  storagePath: string
  thumbnailStoragePath: string | null
  mimeType: string
  byteSize: number
  checksum: string
}

export interface StoredDiveMateMedia {
  pictures: Map<string, StoredImage>
  certificationScans: Map<string, { scan1?: StoredImage; scan2?: StoredImage }>
}

async function storeImage(
  storage: StorageProvider,
  category: 'certifications' | 'pictures',
  externalId: string,
  bytes: Uint8Array,
  mimeType: string,
  signal: AbortSignal,
): Promise<StoredImage> {
  signal.throwIfAborted()
  const fingerprint = createHash('sha256').update(bytes).digest('hex')
  const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1]
  const storagePath = `divemate/${category}/${externalId}/${fingerprint}.${extension}`
  if (!(await storage.exists(storagePath))) {
    signal.throwIfAborted()
    await storage.upload(
      new Blob([Uint8Array.from(bytes)], { type: mimeType }),
      storagePath,
    )
  }
  const thumbnailStoragePath = thumbnailPathFor(storagePath)
  if (!(await storage.exists(thumbnailStoragePath))) {
    signal.throwIfAborted()
    const thumbnail = await createThumbnail(
      bytes,
      category === 'certifications' ? 'certification' : 'photo',
    )
    await storage.upload(
      new Blob([Uint8Array.from(thumbnail)], { type: 'image/webp' }),
      thumbnailStoragePath,
    )
  }
  return {
    storagePath,
    thumbnailStoragePath,
    mimeType,
    byteSize: bytes.byteLength,
    checksum: fingerprint,
  }
}

/**
 * Downloads whichever pictures and certification scans the snapshot did not
 * already carry inline, from the Google Drive backup, before storage.
 */
export async function loadGoogleDriveImages(
  snapshot: DiveMateSnapshot,
  drive: Awaited<ReturnType<typeof openGoogleDriveBackup>>,
  maximumImageBytes: number,
  signal: AbortSignal,
): Promise<ExternalImages> {
  const downloaded = new Map<string, Promise<Uint8Array>>()
  const download = (file: (typeof drive.files)[number]) => {
    const existing = downloaded.get(file.id)
    if (existing) return existing
    const pending = drive.download(file, maximumImageBytes)
    downloaded.set(file.id, pending)
    return pending
  }
  const pictures = new Map<string, { bytes: Uint8Array; mimeType: string }>()
  for (const picture of snapshot.pictures) {
    signal.throwIfAborted()
    if (picture.imageBytes) continue
    const file = findDriveFile(drive.files, picture.path, 'Media')
    if (!file?.mimeType.startsWith('image/')) continue
    pictures.set(picture.externalId, {
      bytes: await download(file),
      mimeType: file.mimeType,
    })
  }

  const certificationScans: ExternalImages['certificationScans'] = new Map()
  for (const certification of snapshot.certifications) {
    signal.throwIfAborted()
    const scans: NonNullable<ReturnType<ExternalImages['certificationScans']['get']>> = {}
    const scan1File = certification.scan1Bytes
      ? null
      : findDriveFile(drive.files, certification.scan1Path)
    const scan2File = certification.scan2Bytes
      ? null
      : findDriveFile(drive.files, certification.scan2Path)
    if (scan1File?.mimeType.startsWith('image/')) {
      scans.scan1 = {
        bytes: await download(scan1File),
        mimeType: scan1File.mimeType,
      }
    }
    if (scan2File?.mimeType.startsWith('image/')) {
      scans.scan2 = {
        bytes: await download(scan2File),
        mimeType: scan2File.mimeType,
      }
    }
    if (scans.scan1 || scans.scan2) {
      certificationScans.set(certification.externalId, scans)
    }
  }
  return { pictures, certificationScans }
}

/**
 * Uploads every picture and certification scan the snapshot carries — inline
 * or from the Google Drive fetch — to object storage, deduplicating on
 * content hash so a re-imported file is not written twice.
 */
export async function storeSnapshotMedia(
  snapshot: DiveMateSnapshot,
  signal: AbortSignal,
  externalImages?: ExternalImages,
): Promise<StoredDiveMateMedia> {
  const storage = getStorage()
  const storedPictures = new Map<string, StoredImage>()
  for (const picture of snapshot.pictures) {
    signal.throwIfAborted()
    const external = externalImages?.pictures.get(picture.externalId)
    const bytes = picture.imageBytes ?? external?.bytes
    const mimeType = picture.mimeType ?? external?.mimeType
    if (!bytes || !mimeType) continue
    storedPictures.set(
      picture.externalId,
      await storeImage(storage, 'pictures', picture.externalId, bytes, mimeType, signal),
    )
  }
  const storedCertificationScans = new Map<
    string,
    { scan1?: StoredImage; scan2?: StoredImage }
  >()
  for (const certification of snapshot.certifications) {
    signal.throwIfAborted()
    const scans: { scan1?: StoredImage; scan2?: StoredImage } = {}
    const external = externalImages?.certificationScans.get(certification.externalId)
    const scan1Bytes = certification.scan1Bytes ?? external?.scan1?.bytes
    const scan1MimeType = certification.scan1MimeType ?? external?.scan1?.mimeType
    const scan2Bytes = certification.scan2Bytes ?? external?.scan2?.bytes
    const scan2MimeType = certification.scan2MimeType ?? external?.scan2?.mimeType
    if (scan1Bytes && scan1MimeType) {
      scans.scan1 = await storeImage(
        storage,
        'certifications',
        `${certification.externalId}/front`,
        scan1Bytes,
        scan1MimeType,
        signal,
      )
    }
    if (scan2Bytes && scan2MimeType) {
      scans.scan2 = await storeImage(
        storage,
        'certifications',
        `${certification.externalId}/back`,
        scan2Bytes,
        scan2MimeType,
        signal,
      )
    }
    if (scans.scan1 || scans.scan2)
      storedCertificationScans.set(certification.externalId, scans)
  }
  return {
    pictures: storedPictures,
    certificationScans: storedCertificationScans,
  }
}
