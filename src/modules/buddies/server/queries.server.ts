import '@tanstack/react-start/server-only'

import { asc, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { buddies, diveBuddies, diveSites, dives, diveTypes } from '@/db/schema'

export async function loadBuddiesOverview() {
  const db = getDb()
  return db
    .select({
      id: buddies.id,
      firstName: buddies.firstName,
      lastName: buddies.lastName,
      email: buddies.email,
      city: buddies.city,
      country: buddies.country,
      diveCount: sql<number>`count(${dives.id})::integer`,
      lastDiveDate: sql<string | null>`max(${dives.diveDate})`,
    })
    .from(buddies)
    .leftJoin(diveBuddies, eq(diveBuddies.buddyId, buddies.id))
    .leftJoin(dives, eq(diveBuddies.diveId, dives.id))
    .groupBy(buddies.id)
    .orderBy(desc(sql`count(${dives.id})`), asc(buddies.lastName), asc(buddies.firstName))
}

export async function loadBuddyDetail(buddyId: string) {
  const db = getDb()
  const [buddy] = await db.select().from(buddies).where(eq(buddies.id, buddyId)).limit(1)
  if (!buddy) return null

  const sharedDives = await db
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
    .orderBy(desc(dives.diveDate), desc(dives.entryTime))

  return { buddy, dives: sharedDives }
}
