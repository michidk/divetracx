import '@tanstack/react-start/server-only'

import { and, count, eq, ne, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { certifications, externalRecordLinks } from '@/db/schema'
import { getStorage } from '@/lib/storage'
import type { EntityWrite } from '@/modules/data/field-contract'
import { validateEntityInput } from '@/modules/data/field-contract'
import { type CertificationInput, certificationContract } from '../credential-contracts'
import { assertAgencyExists } from './agencies.server'
import { primaryDiverId } from './diver-identity.server'

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

export async function saveCertification(
  id: 'new' | string,
  input: EntityWrite<CertificationInput>,
) {
  const fields = validateEntityInput(certificationContract, input, {
    mode: id === 'new' ? 'create' : 'update',
  })
  if (fields.agencyId) {
    const agency = await assertAgencyExists(getDb(), fields.agencyId)
    // organization is a denormalized copy of the agency's name, kept for
    // provenance and display without joining agencies on every read.
    ;(fields as { organization?: string | null }).organization = agency.name
  }
  const values = { ...fields, updatedAt: new Date() }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(certifications)
          .values({
            ...(values as CertificationInput & { organization: string; updatedAt: Date }),
            diverId: await primaryDiverId(),
          })
          .returning({ id: certifications.id })
      : await getDb()
          .update(certifications)
          .set(values)
          .where(eq(certifications.id, id))
          .returning({ id: certifications.id })
  if (!row) throw new Error('Certification was not found')
  return row.id
}

export async function deleteCertification(id: string) {
  const [row] = await getDb()
    .select({
      scan1: certifications.scan1StoragePath,
      scan1Thumbnail: certifications.scan1ThumbnailStoragePath,
      scan2: certifications.scan2StoragePath,
      scan2Thumbnail: certifications.scan2ThumbnailStoragePath,
    })
    .from(certifications)
    .where(eq(certifications.id, id))
    .limit(1)
  const scanPaths = [
    row?.scan1,
    row?.scan1Thumbnail,
    row?.scan2,
    row?.scan2Thumbnail,
  ].filter((path): path is string => Boolean(path))

  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'certification'),
          eq(externalRecordLinks.canonicalEntityId, id),
        ),
      )
    const [deleted] = await transaction
      .delete(certifications)
      .where(eq(certifications.id, id))
      .returning({ id: certifications.id })
    if (!deleted) throw new Error('The record was not found')
  })

  const storage = getStorage()
  await Promise.allSettled(scanPaths.map((path) => storage.delete(path)))
}
