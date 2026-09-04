import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import { buddies, divers, diveSites, dives, equipment, pictures } from '@/db/schema'
import { createThumbnail, thumbnailPathFor } from '@/lib/server/thumbnail.server'
import { getStorage } from '@/lib/storage'

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const uploadTargetSchema = z.object({
  target: z.enum(['dive', 'site', 'gear', 'profile', 'buddy']),
  id: z.string().uuid(),
})

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status })
}

async function targetExists(
  target: 'dive' | 'site' | 'gear' | 'profile' | 'buddy',
  id: string,
) {
  const db = getDb()
  if (target === 'dive') {
    const [row] = await db
      .select({ id: dives.id })
      .from(dives)
      .where(eq(dives.id, id))
      .limit(1)
    return Boolean(row)
  }
  const table =
    target === 'site'
      ? diveSites
      : target === 'gear'
        ? equipment
        : target === 'buddy'
          ? buddies
          : divers
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, id))
    .limit(1)
  return Boolean(row)
}

export async function handlePhotoUpload(request: Request): Promise<Response> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse(400, 'Expected a multipart form upload')
  }

  const parsedTarget = uploadTargetSchema.safeParse({
    target: formData.get('target'),
    id: formData.get('id'),
  })
  if (!parsedTarget.success) return errorResponse(400, 'Invalid upload target')
  const { target, id } = parsedTarget.data
  if (!(await targetExists(target, id))) {
    return errorResponse(404, `The ${target} was not found`)
  }

  const files = formData.getAll('files').filter((entry) => entry instanceof File)
  if (files.length === 0) return errorResponse(400, 'No files were uploaded')
  const isProfileTarget = target === 'profile' || target === 'buddy'
  if (isProfileTarget && files.length > 1) {
    return errorResponse(400, 'Choose one profile image')
  }

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      return errorResponse(415, `${file.name || 'A file'} is not a supported image`)
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse(413, `${file.name || 'A file'} exceeds 25 MB`)
    }
  }

  const db = getDb()
  const storage = getStorage()
  const targetColumn =
    target === 'dive'
      ? pictures.diveId
      : target === 'site'
        ? pictures.siteId
        : target === 'gear'
          ? pictures.equipmentId
          : target === 'buddy'
            ? pictures.buddyId
            : pictures.diverId
  const [sort] = await db
    .select({ next: sql<number>`coalesce(max(${pictures.sortOrder}), 0) + 1` })
    .from(pictures)
    .where(
      isProfileTarget
        ? and(eq(targetColumn, id), eq(pictures.kind, 'profile'))
        : eq(targetColumn, id),
    )
  let sortOrder = sort?.next ?? 1

  let uploaded = 0
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const extension = ALLOWED_IMAGE_TYPES[file.type]
    const basePath = `uploads/${
      target === 'profile'
        ? 'profiles'
        : target === 'buddy'
          ? 'buddy-profiles'
          : `${target}s`
    }/${id}/${hash}`
    const storagePath = `${basePath}.${extension}`
    const thumbnailStoragePath = thumbnailPathFor(storagePath)

    const thumbnail = await createThumbnail(bytes, isProfileTarget ? 'profile' : 'photo')
    await storage.upload(new Blob([arrayBuffer], { type: file.type }), storagePath)
    await storage.upload(
      new Blob([new Uint8Array(thumbnail).buffer], { type: 'image/webp' }),
      thumbnailStoragePath,
    )

    const previousProfilePictures = isProfileTarget
      ? await db
          .select({
            id: pictures.id,
            storagePath: pictures.storagePath,
            thumbnailStoragePath: pictures.thumbnailStoragePath,
          })
          .from(pictures)
          .where(and(eq(targetColumn, id), eq(pictures.kind, 'profile')))
      : []

    await db.transaction(async (transaction) => {
      if (isProfileTarget) {
        await transaction
          .delete(pictures)
          .where(and(eq(targetColumn, id), eq(pictures.kind, 'profile')))
      }
      await transaction.insert(pictures).values({
        kind: isProfileTarget ? 'profile' : 'photo',
        diveId: target === 'dive' ? id : null,
        siteId: target === 'site' ? id : null,
        equipmentId: target === 'gear' ? id : null,
        diverId: target === 'profile' ? id : null,
        buddyId: target === 'buddy' ? id : null,
        path: file.name || storagePath,
        storagePath,
        thumbnailStoragePath,
        mimeType: file.type,
        byteSize: bytes.byteLength,
        description: isProfileTarget ? 'Profile image' : null,
        sortOrder,
      })
    })

    if (isProfileTarget) {
      const oldPaths = previousProfilePictures.flatMap((picture) =>
        [picture.storagePath, picture.thumbnailStoragePath].filter(
          (path): path is string =>
            Boolean(path) && path !== storagePath && path !== thumbnailStoragePath,
        ),
      )
      await Promise.allSettled(oldPaths.map((path) => storage.delete(path)))
    }
    sortOrder += 1
    uploaded += 1
  }

  return Response.json({ uploaded })
}
