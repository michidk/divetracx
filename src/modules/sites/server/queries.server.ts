import '@tanstack/react-start/server-only'

import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { diveSites, dives, pictures } from '@/db/schema'

export async function loadSitesOverview() {
  const db = getDb()
  return db
    .select({
      id: diveSites.id,
      name: diveSites.name,
      country: diveSites.country,
      region: diveSites.region,
      waterName: diveSites.waterName,
      latitude: diveSites.latitude,
      longitude: diveSites.longitude,
      difficulty: diveSites.difficulty,
      rating: diveSites.rating,
      diveCount: sql<number>`count(${dives.id})::integer`,
      lastDiveDate: sql<string | null>`max(${dives.diveDate})`,
      deepestMeters: sql<string | null>`max(${dives.maximumDepthMeters})`,
    })
    .from(diveSites)
    .leftJoin(dives, eq(dives.siteId, diveSites.id))
    .groupBy(diveSites.id)
    .orderBy(desc(sql`max(${dives.diveDate})`), asc(diveSites.name))
}

export async function loadSiteDetail(siteId: string) {
  const db = getDb()
  const [site] = await db
    .select()
    .from(diveSites)
    .where(eq(diveSites.id, siteId))
    .limit(1)
  if (!site) return null

  const [siteDives, sitePictures] = await Promise.all([
    db
      .select({
        id: dives.id,
        number: dives.number,
        diveDate: dives.diveDate,
        durationSeconds: dives.durationSeconds,
        maximumDepthMeters: dives.maximumDepthMeters,
        waterTemperatureCelsius: dives.waterTemperatureCelsius,
        rating: dives.rating,
      })
      .from(dives)
      .where(eq(dives.siteId, siteId))
      .orderBy(desc(dives.diveDate), desc(dives.entryTime)),
    db
      .select({
        id: pictures.id,
        path: pictures.path,
        storagePath: pictures.storagePath,
        thumbnailStoragePath: pictures.thumbnailStoragePath,
        description: pictures.description,
      })
      .from(pictures)
      .where(
        and(
          eq(pictures.siteId, siteId),
          eq(pictures.kind, 'photo'),
          isNotNull(pictures.storagePath),
        ),
      )
      .orderBy(sql`${pictures.sortOrder} nulls last`, asc(pictures.path)),
  ])

  return { site, dives: siteDives, pictures: sitePictures }
}
