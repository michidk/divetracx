import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { agencies, certifications, divers } from '@/db/schema'
import { getStorage } from '@/lib/storage'
import {
  deleteCertification,
  MAX_FEATURED_CERTIFICATIONS,
  saveCertification,
  updateCertificationCardFeature,
} from './certifications.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'

describe.skipIf(!enabled)('featured-certification limit database contract', () => {
  beforeAll(async () => {
    await getDb().delete(certifications)
  })

  afterAll(async () => {
    await closeDb()
  })

  async function seedCertifications(count: number) {
    const db = getDb()
    const rows = await db
      .insert(certifications)
      .values(
        Array.from({ length: count }, (_, index) => ({ name: `Certification ${index}` })),
      )
      .returning({ id: certifications.id })
    return rows.map((row) => row.id)
  }

  test('rejects featuring a certification that does not exist', async () => {
    await expect(
      updateCertificationCardFeature({
        certificationId: '11111111-1111-4111-8111-111111111111',
        featured: true,
      }),
    ).rejects.toThrow('Certification was not found')
  })

  test('enforces the featured maximum and allows featuring again once room opens up', async () => {
    const db = getDb()
    const ids = await seedCertifications(MAX_FEATURED_CERTIFICATIONS + 1)
    const [toStayUnfeatured, ...toFeature] = ids
    if (!toStayUnfeatured || toFeature.length !== MAX_FEATURED_CERTIFICATIONS) {
      throw new Error('Seed certifications were not created as expected')
    }

    for (const id of toFeature) {
      const result = await updateCertificationCardFeature({
        certificationId: id,
        featured: true,
      })
      expect(result).toEqual({ featured: true })
    }

    await expect(
      updateCertificationCardFeature({
        certificationId: toStayUnfeatured,
        featured: true,
      }),
    ).rejects.toThrow(`You can star up to ${MAX_FEATURED_CERTIFICATIONS} certifications`)
    expect(
      (
        await db
          .select({ featuredOnCard: certifications.featuredOnCard })
          .from(certifications)
          .where(eq(certifications.id, toStayUnfeatured))
      )[0]?.featuredOnCard,
    ).toBe(false)

    const freed = toFeature[0]
    if (!freed) throw new Error('Expected at least one featured certification')
    await updateCertificationCardFeature({ certificationId: freed, featured: false })
    await updateCertificationCardFeature({
      certificationId: toStayUnfeatured,
      featured: true,
    })

    const featuredCount = (
      await db
        .select({ id: certifications.id })
        .from(certifications)
        .where(eq(certifications.featuredOnCard, true))
    ).length
    expect(featuredCount).toBe(MAX_FEATURED_CERTIFICATIONS)
  })

  test('serializes concurrent feature requests through the advisory lock so the limit is never exceeded', async () => {
    await getDb().delete(certifications)
    const ids = await seedCertifications(MAX_FEATURED_CERTIFICATIONS + 2)
    const alreadyFeatured = ids.slice(0, MAX_FEATURED_CERTIFICATIONS - 1)
    const contenders = ids.slice(MAX_FEATURED_CERTIFICATIONS - 1)
    expect(contenders).toHaveLength(3)

    for (const id of alreadyFeatured) {
      await updateCertificationCardFeature({ certificationId: id, featured: true })
    }

    const outcomes = await Promise.allSettled(
      contenders.map((id) =>
        updateCertificationCardFeature({ certificationId: id, featured: true }),
      ),
    )
    // One slot remains, so exactly one of the three concurrent attempts wins.
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(2)

    const featuredCount = (
      await getDb()
        .select({ id: certifications.id })
        .from(certifications)
        .where(eq(certifications.featuredOnCard, true))
    ).length
    expect(featuredCount).toBe(MAX_FEATURED_CERTIFICATIONS)
  })
})

describe.skipIf(!enabled)('manual certification mutations database contract', () => {
  let agencyId: string
  let storageDir: string

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'divetracx-certification-mutations-'))
    process.env.STORAGE_PROVIDER = 'local'
    process.env.STORAGE_PATH = storageDir
    process.env.STORAGE_URL = '/media'

    const db = getDb()
    await db.delete(certifications)
    await db.delete(divers)
    await db.insert(divers).values({ firstName: 'Primary' })
    // Built-in agencies such as PADI are already seeded by migrations, so a
    // distinct name avoids colliding with their unique normalized name.
    await db
      .delete(agencies)
      .where(eq(agencies.normalizedName, 'test-certification-mutation-agency'))
    const [agency] = await db
      .insert(agencies)
      .values({
        name: 'Test Certification Mutation Agency',
        normalizedName: 'test-certification-mutation-agency',
      })
      .returning({ id: agencies.id })
    if (!agency) throw new Error('Seed agency was not created')
    agencyId = agency.id
  })

  afterAll(async () => {
    await closeDb()
    await rm(storageDir, { recursive: true, force: true })
  })

  test('rejects a certification without an existing agency, assigns the primary diver, and cleans up stored scans on delete', async () => {
    const db = getDb()
    const [primaryDiver] = await db.select({ id: divers.id }).from(divers).limit(1)
    if (!primaryDiver) throw new Error('Primary diver seed is missing')

    await expect(saveCertification('new', { name: 'Open Water' })).rejects.toThrow(
      'Agency is required',
    )
    await expect(
      saveCertification('new', {
        name: 'Open Water',
        agencyId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow('Select an existing agency')

    const certificationId = await saveCertification('new', {
      name: 'Open Water',
      agencyId,
      certificationNumber: 'OW-123',
    })
    const [created] = await db
      .select()
      .from(certifications)
      .where(eq(certifications.id, certificationId))
    expect(created).toMatchObject({
      name: 'Open Water',
      agencyId,
      organization: 'Test Certification Mutation Agency',
      diverId: primaryDiver.id,
    })

    const storage = getStorage()
    const scanPath = `certifications/${certificationId}-scan-1.jpg`
    const thumbnailPath = `certifications/${certificationId}-scan-1-thumb.jpg`
    await storage.upload(new Blob(['scan']), scanPath)
    await storage.upload(new Blob(['thumb']), thumbnailPath)
    expect(await storage.exists(scanPath)).toBe(true)
    await db
      .update(certifications)
      .set({ scan1StoragePath: scanPath, scan1ThumbnailStoragePath: thumbnailPath })
      .where(eq(certifications.id, certificationId))

    await deleteCertification(certificationId)

    expect(
      await db
        .select()
        .from(certifications)
        .where(eq(certifications.id, certificationId)),
    ).toHaveLength(0)
    expect(await storage.exists(scanPath)).toBe(false)
    expect(await storage.exists(thumbnailPath)).toBe(false)
  })
})
