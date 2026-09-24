import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { certifications } from '@/db/schema'
import {
  MAX_FEATURED_CERTIFICATIONS,
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
