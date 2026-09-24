import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { externalRecordLinks, externalRecords, integrations, pictures } from '@/db/schema'
import { getStorage } from '@/lib/storage'
import { deletePictureRecord } from './mutations.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-media-mutations'

describe.skipIf(!enabled)('manual picture deletion database contract', () => {
  let storageDir: string

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'divetracx-media-mutations-'))
    process.env.STORAGE_PROVIDER = 'local'
    process.env.STORAGE_PATH = storageDir
    process.env.STORAGE_URL = '/media'

    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(externalRecords)
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
    await db.delete(pictures)
  })

  afterAll(async () => {
    await closeDb()
    await rm(storageDir, { recursive: true, force: true })
  })

  test('deletes the database row, removes provenance, and best-effort deletes the original and thumbnail objects', async () => {
    const db = getDb()
    const storage = getStorage()
    const originalPath = 'pictures/original.jpg'
    const thumbnailPath = 'pictures/thumbnail.jpg'
    await storage.upload(new Blob(['original']), originalPath)
    await storage.upload(new Blob(['thumbnail']), thumbnailPath)
    expect(await storage.exists(originalPath)).toBe(true)
    expect(await storage.exists(thumbnailPath)).toBe(true)

    const [picture] = await db
      .insert(pictures)
      .values({
        path: originalPath,
        storagePath: originalPath,
        thumbnailStoragePath: thumbnailPath,
      })
      .returning({ id: pictures.id })
    if (!picture) throw new Error('Seed picture was not created')

    await db.insert(integrations).values({
      key: INTEGRATION_KEY,
      displayName: 'Test media mutation integration',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['pictures'],
    })
    const [externalRecord] = await db
      .insert(externalRecords)
      .values({
        integrationKey: INTEGRATION_KEY,
        entityType: 'picture',
        identityKey: 'picture-1',
        rawPayload: {},
        contentHash: 'hash-1',
      })
      .returning({ id: externalRecords.id })
    if (!externalRecord) throw new Error('Seed external record was not created')
    await db.insert(externalRecordLinks).values({
      externalRecordId: externalRecord.id,
      canonicalEntityType: 'picture',
      canonicalEntityId: picture.id,
      role: 'produced',
    })

    await deletePictureRecord(picture.id)

    expect(
      await db.select().from(pictures).where(eq(pictures.id, picture.id)),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(externalRecordLinks)
        .where(eq(externalRecordLinks.externalRecordId, externalRecord.id)),
    ).toHaveLength(0)
    expect(await storage.exists(originalPath)).toBe(false)
    expect(await storage.exists(thumbnailPath)).toBe(false)
  })

  test('deletes the database row even when it has no stored objects, and rejects a missing picture', async () => {
    const db = getDb()
    const [picture] = await db
      .insert(pictures)
      .values({ path: 'pictures/no-storage.jpg' })
      .returning({ id: pictures.id })
    if (!picture) throw new Error('Seed picture was not created')

    await deletePictureRecord(picture.id)
    expect(
      await db.select().from(pictures).where(eq(pictures.id, picture.id)),
    ).toHaveLength(0)

    await expect(deletePictureRecord(picture.id)).rejects.toThrow(
      'The picture was not found',
    )
  })
})
