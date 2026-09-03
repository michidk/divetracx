import '@tanstack/react-start/server-only'

import { and, count, eq, ne, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { certifications } from '@/db/schema'

export const MAX_FEATURED_CERTIFICATIONS = 8

export async function updateCertificationCardFeature({
  certificationId,
  featured,
}: {
  certificationId: string
  featured: boolean
}) {
  return getDb().transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext('divetracx-featured-certifications'))`,
    )

    const [certification] = await transaction
      .select({ id: certifications.id })
      .from(certifications)
      .where(eq(certifications.id, certificationId))
      .limit(1)
    if (!certification) throw new Error('Certification was not found')

    if (featured) {
      const [result] = await transaction
        .select({ value: count() })
        .from(certifications)
        .where(
          and(
            eq(certifications.featuredOnCard, true),
            ne(certifications.id, certificationId),
          ),
        )
      if ((result?.value ?? 0) >= MAX_FEATURED_CERTIFICATIONS) {
        throw new Error(
          `You can star up to ${MAX_FEATURED_CERTIFICATIONS} certifications for your card`,
        )
      }
    }

    await transaction
      .update(certifications)
      .set({ featuredOnCard: featured, updatedAt: new Date() })
      .where(eq(certifications.id, certificationId))
    return { featured }
  })
}
