import '@tanstack/react-start/server-only'

import { asc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { agencyMemberships, certifications, divers, dives } from '@/db/schema'

function certificationScans(certification: typeof certifications.$inferSelect) {
  const scans: Array<{
    id: string
    path: string
    storagePath: string | null
    thumbnailStoragePath: string | null
    description: string | null
  }> = []
  if (certification.scan1StoragePath) {
    scans.push({
      id: `${certification.id}-front`,
      path: certification.scan1Path ?? 'Certification front',
      storagePath: certification.scan1StoragePath,
      thumbnailStoragePath: certification.scan1ThumbnailStoragePath,
      description: `${certification.name} · front`,
    })
  }
  if (certification.scan2StoragePath) {
    scans.push({
      id: `${certification.id}-back`,
      path: certification.scan2Path ?? 'Certification back',
      storagePath: certification.scan2StoragePath,
      thumbnailStoragePath: certification.scan2ThumbnailStoragePath,
      description: `${certification.name} · back`,
    })
  }
  return scans
}

export async function loadProfile() {
  const db = getDb()
  const [diver] = await db.select().from(divers).orderBy(asc(divers.createdAt)).limit(1)

  const [certificationRows, membershipRows, [logbook]] = await Promise.all([
    db
      .select()
      .from(certifications)
      .orderBy(
        sql`${certifications.sortOrder} nulls last`,
        asc(certifications.certifiedAt),
      ),
    db.select().from(agencyMemberships).orderBy(asc(agencyMemberships.createdAt)),
    db
      .select({
        totalDives: sql<number>`count(*)::integer`,
        totalSeconds: sql<number>`coalesce(sum(${dives.durationSeconds}), 0)::integer`,
        firstDiveDate: sql<string | null>`min(${dives.diveDate})`,
        latestDiveDate: sql<string | null>`max(${dives.diveDate})`,
      })
      .from(dives),
  ])

  return {
    diver: diver ?? null,
    certifications: certificationRows.map((certification) => ({
      id: certification.id,
      name: certification.name,
      organization: certification.organization,
      certificationNumber: certification.certificationNumber,
      certifiedAt: certification.certifiedAt,
      instructorName: certification.instructorName,
      scans: certificationScans(certification),
    })),
    agencyMemberships: membershipRows,
    logbook: logbook ?? {
      totalDives: 0,
      totalSeconds: 0,
      firstDiveDate: null,
      latestDiveDate: null,
    },
  }
}

export async function loadAgencyMembership(agencyMembershipId: string) {
  const [membership] = await getDb()
    .select()
    .from(agencyMemberships)
    .where(eq(agencyMemberships.id, agencyMembershipId))
    .limit(1)
  return membership ?? null
}

export async function loadCertification(certificationId: string) {
  const [certification] = await getDb()
    .select()
    .from(certifications)
    .where(eq(certifications.id, certificationId))
    .limit(1)
  if (!certification) return null
  return { certification, scans: certificationScans(certification) }
}
