import '@tanstack/react-start/server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  agencies,
  agencyMemberships,
  buddies,
  certifications,
  divers,
  dives,
  pictures,
} from '@/db/schema'

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

  const [certificationRows, membershipRows, [logbook], profileImages] = await Promise.all(
    [
      db
        .select({
          certification: certifications,
          instructor: {
            id: buddies.id,
            firstName: buddies.firstName,
            lastName: buddies.lastName,
          },
        })
        .from(certifications)
        .leftJoin(buddies, eq(certifications.instructorBuddyId, buddies.id))
        .orderBy(
          sql`${certifications.sortOrder} nulls last`,
          asc(certifications.certifiedAt),
        ),
      db
        .select({ membership: agencyMemberships, agency: agencies })
        .from(agencyMemberships)
        .innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
        .orderBy(asc(agencyMemberships.createdAt)),
      db
        .select({
          totalDives: sql<number>`count(*)::integer`,
          totalSeconds: sql<number>`coalesce(sum(${dives.durationSeconds}), 0)::integer`,
          firstDiveDate: sql<string | null>`min(${dives.diveDate})`,
          latestDiveDate: sql<string | null>`max(${dives.diveDate})`,
          maximumDepthMeters: sql<number>`coalesce(max(${dives.maximumDepthMeters})::double precision, 0)`,
          visitedSites: sql<number>`count(distinct ${dives.siteId})::integer`,
        })
        .from(dives),
      diver
        ? db
            .select({
              id: pictures.id,
              path: pictures.path,
              storagePath: pictures.storagePath,
              thumbnailStoragePath: pictures.thumbnailStoragePath,
              description: pictures.description,
            })
            .from(pictures)
            .where(and(eq(pictures.diverId, diver.id), eq(pictures.kind, 'profile')))
            .orderBy(desc(pictures.createdAt))
            .limit(1)
        : Promise.resolve([]),
    ],
  )

  return {
    diver: diver ?? null,
    profileImage: profileImages[0] ?? null,
    certifications: certificationRows.map(({ certification, instructor }) => ({
      id: certification.id,
      name: certification.name,
      organization: certification.organization,
      certificationNumber: certification.certificationNumber,
      certifiedAt: certification.certifiedAt,
      instructor: instructor?.id
        ? {
            id: instructor.id,
            firstName: instructor.firstName,
            lastName: instructor.lastName,
          }
        : null,
      scans: certificationScans(certification),
    })),
    agencyMemberships: membershipRows.map(({ membership, agency }) => ({
      ...membership,
      agency,
    })),
    logbook: logbook ?? {
      totalDives: 0,
      totalSeconds: 0,
      firstDiveDate: null,
      latestDiveDate: null,
      maximumDepthMeters: 0,
      visitedSites: 0,
    },
  }
}

export async function loadAgencyMembership(agencyMembershipId: string) {
  const [membership] = await getDb()
    .select({ membership: agencyMemberships, agency: agencies })
    .from(agencyMemberships)
    .innerJoin(agencies, eq(agencyMemberships.agencyId, agencies.id))
    .where(eq(agencyMemberships.id, agencyMembershipId))
    .limit(1)
  return membership ? { ...membership.membership, agency: membership.agency } : null
}

export async function loadCertification(certificationId: string) {
  const [result] = await getDb()
    .select({ certification: certifications, agency: agencies })
    .from(certifications)
    .leftJoin(agencies, eq(certifications.agencyId, agencies.id))
    .where(eq(certifications.id, certificationId))
    .limit(1)
  if (!result) return null
  return {
    certification: result.certification,
    agency: result.agency,
    scans: certificationScans(result.certification),
  }
}

export async function loadCertificationInstructorOptions() {
  return getDb()
    .select({
      id: buddies.id,
      firstName: buddies.firstName,
      lastName: buddies.lastName,
    })
    .from(buddies)
    .orderBy(asc(buddies.lastName), asc(buddies.firstName), asc(buddies.createdAt))
}
