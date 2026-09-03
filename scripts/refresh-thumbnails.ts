import { eq, isNotNull } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { certifications, pictures } from '@/db/schema'
import {
  createThumbnail,
  type ThumbnailUse,
  thumbnailPathFor,
} from '@/lib/server/thumbnail.server'
import { getStorage } from '@/lib/storage'

interface ThumbnailJob {
  label: string
  originalPath: string
  thumbnailPath: string
  use: ThumbnailUse
  recordPath(): Promise<void>
}

async function loadJobs(): Promise<ThumbnailJob[]> {
  const db = getDb()
  const [pictureRows, certificationRows] = await Promise.all([
    db
      .select({
        id: pictures.id,
        originalPath: pictures.storagePath,
        thumbnailPath: pictures.thumbnailStoragePath,
      })
      .from(pictures)
      .where(isNotNull(pictures.storagePath)),
    db
      .select({
        id: certifications.id,
        frontOriginalPath: certifications.scan1StoragePath,
        frontThumbnailPath: certifications.scan1ThumbnailStoragePath,
        backOriginalPath: certifications.scan2StoragePath,
        backThumbnailPath: certifications.scan2ThumbnailStoragePath,
      })
      .from(certifications),
  ])

  const jobs: ThumbnailJob[] = []
  for (const row of pictureRows) {
    if (!row.originalPath) continue
    const thumbnailPath = row.thumbnailPath ?? thumbnailPathFor(row.originalPath)
    jobs.push({
      label: `picture ${row.id}`,
      originalPath: row.originalPath,
      thumbnailPath,
      use: 'photo',
      recordPath: async () => {
        if (row.thumbnailPath) return
        await db
          .update(pictures)
          .set({ thumbnailStoragePath: thumbnailPath, updatedAt: new Date() })
          .where(eq(pictures.id, row.id))
      },
    })
  }

  for (const row of certificationRows) {
    if (row.frontOriginalPath) {
      const thumbnailPath =
        row.frontThumbnailPath ?? thumbnailPathFor(row.frontOriginalPath)
      jobs.push({
        label: `certification ${row.id} front`,
        originalPath: row.frontOriginalPath,
        thumbnailPath,
        use: 'certification',
        recordPath: async () => {
          if (row.frontThumbnailPath) return
          await db
            .update(certifications)
            .set({ scan1ThumbnailStoragePath: thumbnailPath, updatedAt: new Date() })
            .where(eq(certifications.id, row.id))
        },
      })
    }
    if (row.backOriginalPath) {
      const thumbnailPath =
        row.backThumbnailPath ?? thumbnailPathFor(row.backOriginalPath)
      jobs.push({
        label: `certification ${row.id} back`,
        originalPath: row.backOriginalPath,
        thumbnailPath,
        use: 'certification',
        recordPath: async () => {
          if (row.backThumbnailPath) return
          await db
            .update(certifications)
            .set({ scan2ThumbnailStoragePath: thumbnailPath, updatedAt: new Date() })
            .where(eq(certifications.id, row.id))
        },
      })
    }
  }
  return jobs
}

try {
  const storage = getStorage()
  const jobs = await loadJobs()
  let refreshed = 0
  const failures: string[] = []

  for (const job of jobs) {
    try {
      const original = await storage.download(job.originalPath)
      const thumbnail = await createThumbnail(
        new Uint8Array(await original.arrayBuffer()),
        job.use,
      )
      await storage.upload(
        new Blob([Uint8Array.from(thumbnail)], { type: 'image/webp' }),
        job.thumbnailPath,
      )
      await job.recordPath()
      refreshed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${job.label}: ${message}`)
    }
  }

  console.log(`Refreshed ${refreshed} of ${jobs.length} image thumbnails.`)
  if (failures.length > 0) {
    throw new Error(`Failed thumbnails:\n${failures.join('\n')}`)
  }
} finally {
  await closeDb()
}
