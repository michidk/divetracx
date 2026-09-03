import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { externalRecordLinks, pictures } from '@/db/schema'
import { getStorage } from '@/lib/storage'

export async function deletePictureRecord(pictureId: string) {
  const db = getDb()
  const [picture] = await db
    .select({
      id: pictures.id,
      storagePath: pictures.storagePath,
      thumbnailStoragePath: pictures.thumbnailStoragePath,
    })
    .from(pictures)
    .where(eq(pictures.id, pictureId))
    .limit(1)
  if (!picture) throw new Error('The picture was not found')

  await db.transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'picture'),
          eq(externalRecordLinks.canonicalEntityId, pictureId),
        ),
      )
    await transaction.delete(pictures).where(eq(pictures.id, pictureId))
  })

  const storage = getStorage()
  const paths = [picture.storagePath, picture.thumbnailStoragePath].filter(
    (path): path is string => Boolean(path),
  )
  await Promise.allSettled(paths.map((path) => storage.delete(path)))
}
