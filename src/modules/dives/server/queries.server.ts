import '@tanstack/react-start/server-only'

import { count, desc, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import { diveSites, dives, syncRuns } from '@/db/schema'

export async function loadDashboard() {
  const db = getDb()
  const [summary] = await db
    .select({
      totalDives: count(),
      totalSeconds: sql<number>`coalesce(sum(${dives.durationSeconds}), 0)::integer`,
      deepestMeters: sql<string>`coalesce(max(${dives.maximumDepthMeters}), 0)`,
      latestDiveDate: sql<string | null>`max(${dives.diveDate})`,
    })
    .from(dives)

  const recentDives = await db
    .select({
      id: dives.id,
      number: dives.number,
      diveDate: dives.diveDate,
      durationSeconds: dives.durationSeconds,
      maximumDepthMeters: dives.maximumDepthMeters,
      siteName: diveSites.name,
      country: diveSites.country,
    })
    .from(dives)
    .leftJoin(diveSites, sql`${dives.siteId} = ${diveSites.id}`)
    .orderBy(desc(dives.diveDate), desc(dives.entryTime))
    .limit(6)

  const [latestSync] = await db
    .select({
      status: syncRuns.status,
      startedAt: syncRuns.startedAt,
      finishedAt: syncRuns.finishedAt,
      counts: syncRuns.counts,
      error: syncRuns.error,
    })
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1)

  return {
    summary: summary ?? {
      totalDives: 0,
      totalSeconds: 0,
      deepestMeters: '0',
      latestDiveDate: null,
    },
    recentDives,
    latestSync: latestSync ?? null,
  }
}

export async function loadDives() {
  const db = getDb()
  return db
    .select({
      id: dives.id,
      number: dives.number,
      diveDate: dives.diveDate,
      entryTime: dives.entryTime,
      durationSeconds: dives.durationSeconds,
      maximumDepthMeters: dives.maximumDepthMeters,
      averageDepthMeters: dives.averageDepthMeters,
      waterTemperatureCelsius: dives.waterTemperatureCelsius,
      siteName: diveSites.name,
      country: diveSites.country,
    })
    .from(dives)
    .leftJoin(diveSites, sql`${dives.siteId} = ${diveSites.id}`)
    .orderBy(desc(dives.diveDate), desc(dives.entryTime))
    .limit(250)
}
