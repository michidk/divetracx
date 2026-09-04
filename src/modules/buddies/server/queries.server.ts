import '@tanstack/react-start/server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  agencies,
  buddies,
  buddyAgencyMemberships,
  buddyCertifications,
  diveBuddies,
  diveSites,
  dives,
  diveTypes,
  pictures,
} from '@/db/schema'

export async function loadBuddiesOverview() {
  const db = getDb()
  const [buddyRows, profileImages] = await Promise.all([
    db
      .select({
        id: buddies.id,
        firstName: buddies.firstName,
        lastName: buddies.lastName,
        email: buddies.email,
        city: buddies.city,
        country: buddies.country,
        instructor: buddies.instructor,
        diveCount: sql<number>`count(${dives.id})::integer`,
        lastDiveDate: sql<string | null>`max(${dives.diveDate})`,
      })
      .from(buddies)
      .leftJoin(diveBuddies, eq(diveBuddies.buddyId, buddies.id))
      .leftJoin(dives, eq(diveBuddies.diveId, dives.id))
      .groupBy(buddies.id)
      .orderBy(
        desc(sql`count(${dives.id})`),
        asc(buddies.lastName),
        asc(buddies.firstName),
      ),
    db
      .select({
        buddyId: pictures.buddyId,
        id: pictures.id,
        storagePath: pictures.storagePath,
        thumbnailStoragePath: pictures.thumbnailStoragePath,
      })
      .from(pictures)
      .where(and(eq(pictures.kind, 'profile'), sql`${pictures.buddyId} is not null`))
      .orderBy(desc(pictures.createdAt)),
  ])
  const profileImageByBuddyId = new Map<string, (typeof profileImages)[number]>()
  for (const image of profileImages) {
    if (image.buddyId && !profileImageByBuddyId.has(image.buddyId)) {
      profileImageByBuddyId.set(image.buddyId, image)
    }
  }
  return buddyRows.map((buddy) => ({
    ...buddy,
    profileImage: profileImageByBuddyId.get(buddy.id) ?? null,
  }))
}

export async function loadBuddyDetail(buddyId: string) {
  const db = getDb()
  const [buddy] = await db.select().from(buddies).where(eq(buddies.id, buddyId)).limit(1)
  if (!buddy) return null

  const [sharedDives, certificationRows, membershipRows, profileImages] =
    await Promise.all([
      db
        .select({
          id: dives.id,
          number: dives.number,
          diveDate: dives.diveDate,
          durationSeconds: dives.durationSeconds,
          maximumDepthMeters: dives.maximumDepthMeters,
          siteName: diveSites.name,
          diveTypeName: diveTypes.name,
        })
        .from(diveBuddies)
        .innerJoin(dives, eq(diveBuddies.diveId, dives.id))
        .leftJoin(diveSites, eq(dives.siteId, diveSites.id))
        .leftJoin(diveTypes, eq(dives.diveTypeId, diveTypes.id))
        .where(eq(diveBuddies.buddyId, buddyId))
        .orderBy(desc(dives.diveDate), desc(dives.entryTime)),
      db
        .select({ certification: buddyCertifications, agency: agencies })
        .from(buddyCertifications)
        .innerJoin(agencies, eq(buddyCertifications.agencyId, agencies.id))
        .where(eq(buddyCertifications.buddyId, buddyId))
        .orderBy(asc(agencies.name), asc(buddyCertifications.name)),
      db
        .select({ membership: buddyAgencyMemberships, agency: agencies })
        .from(buddyAgencyMemberships)
        .innerJoin(agencies, eq(buddyAgencyMemberships.agencyId, agencies.id))
        .where(eq(buddyAgencyMemberships.buddyId, buddyId))
        .orderBy(asc(agencies.name)),
      db
        .select({
          id: pictures.id,
          storagePath: pictures.storagePath,
          thumbnailStoragePath: pictures.thumbnailStoragePath,
        })
        .from(pictures)
        .where(and(eq(pictures.buddyId, buddyId), eq(pictures.kind, 'profile')))
        .orderBy(desc(pictures.createdAt))
        .limit(1),
    ])

  return {
    buddy,
    profileImage: profileImages[0] ?? null,
    dives: sharedDives,
    certifications: certificationRows.map(({ certification, agency }) => ({
      ...certification,
      agency,
    })),
    agencyMemberships: membershipRows.map(({ membership, agency }) => ({
      ...membership,
      agency,
    })),
  }
}

export async function loadBuddyCertification(
  buddyId: string,
  buddyCertificationId: string,
) {
  const [result] = await getDb()
    .select({ certification: buddyCertifications, agency: agencies })
    .from(buddyCertifications)
    .innerJoin(agencies, eq(buddyCertifications.agencyId, agencies.id))
    .where(eq(buddyCertifications.id, buddyCertificationId))
    .limit(1)
  return result?.certification.buddyId === buddyId
    ? { ...result.certification, agency: result.agency }
    : null
}

export async function loadBuddyAgencyMembership(
  buddyId: string,
  buddyAgencyMembershipId: string,
) {
  const [result] = await getDb()
    .select({ membership: buddyAgencyMemberships, agency: agencies })
    .from(buddyAgencyMemberships)
    .innerJoin(agencies, eq(buddyAgencyMemberships.agencyId, agencies.id))
    .where(eq(buddyAgencyMemberships.id, buddyAgencyMembershipId))
    .limit(1)
  return result?.membership.buddyId === buddyId
    ? { ...result.membership, agency: result.agency }
    : null
}
