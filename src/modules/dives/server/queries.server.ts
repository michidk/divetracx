import '@tanstack/react-start/server-only'

import { asc, count, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  buddies,
  diveBuddies,
  diveEquipment,
  diveProfileSamples,
  divers,
  diveSites,
  dives,
  diveTypes,
  equipment,
  shops,
  syncRuns,
  tanks,
} from '@/db/schema'

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

export async function loadDiveSiteMap() {
  const db = getDb()
  return db.transaction(
    async (transaction) => {
      const [sites, siteDives] = await Promise.all([
        transaction
          .select({
            id: diveSites.id,
            name: diveSites.name,
            country: diveSites.country,
            region: diveSites.region,
            waterName: diveSites.waterName,
            latitude: diveSites.latitude,
            longitude: diveSites.longitude,
            maximumDepthMeters: diveSites.maximumDepthMeters,
            altitudeMeters: diveSites.altitudeMeters,
            difficulty: diveSites.difficulty,
            rating: diveSites.rating,
          })
          .from(diveSites)
          .orderBy(asc(diveSites.name)),
        transaction
          .select({
            id: dives.id,
            siteId: dives.siteId,
            number: dives.number,
            diveDate: dives.diveDate,
            maximumDepthMeters: dives.maximumDepthMeters,
          })
          .from(dives)
          .orderBy(desc(dives.diveDate), desc(dives.entryTime)),
      ])

      const divesBySite = new Map<string, typeof siteDives>()
      for (const dive of siteDives) {
        if (!dive.siteId) continue
        const siteEntries = divesBySite.get(dive.siteId) ?? []
        siteEntries.push(dive)
        divesBySite.set(dive.siteId, siteEntries)
      }

      return sites.map((site) => {
        const siteEntries = divesBySite.get(site.id) ?? []
        const deepestMeters = siteEntries.reduce<string | null>((deepest, dive) => {
          if (dive.maximumDepthMeters === null) return deepest
          if (deepest === null || Number(dive.maximumDepthMeters) > Number(deepest)) {
            return dive.maximumDepthMeters
          }
          return deepest
        }, null)
        const latestDive = siteEntries[0]

        return {
          ...site,
          diveCount: siteEntries.length,
          deepestMeters,
          latestDive: latestDive
            ? {
                id: latestDive.id,
                number: latestDive.number,
                diveDate: latestDive.diveDate,
              }
            : null,
        }
      })
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}

export async function loadDive(diveId: string) {
  const db = getDb()
  return db.transaction(
    async (transaction) => {
      const [dive] = await transaction
        .select({
          id: dives.id,
          number: dives.number,
          diveDate: dives.diveDate,
          entryTime: dives.entryTime,
          utcOffsetMinutes: dives.utcOffsetMinutes,
          durationSeconds: dives.durationSeconds,
          surfaceIntervalSeconds: dives.surfaceIntervalSeconds,
          maximumDepthMeters: dives.maximumDepthMeters,
          averageDepthMeters: dives.averageDepthMeters,
          airTemperatureCelsius: dives.airTemperatureCelsius,
          waterTemperatureCelsius: dives.waterTemperatureCelsius,
          weightKg: dives.weightKg,
          visibility: dives.visibility,
          current: dives.current,
          waves: dives.waves,
          weather: dives.weather,
          rating: dives.rating,
          computer: dives.computer,
          suit: dives.suit,
          boat: dives.boat,
          divemaster: dives.divemaster,
          notes: dives.notes,
          sourceKey: dives.sourceKey,
          externalId: dives.externalId,
          sourceUpdatedAt: dives.sourceUpdatedAt,
          updatedAt: dives.updatedAt,
          diver: {
            id: divers.id,
            firstName: divers.firstName,
            lastName: divers.lastName,
          },
          site: {
            id: diveSites.id,
            name: diveSites.name,
            country: diveSites.country,
            region: diveSites.region,
            waterName: diveSites.waterName,
            latitude: diveSites.latitude,
            longitude: diveSites.longitude,
            maximumDepthMeters: diveSites.maximumDepthMeters,
            altitudeMeters: diveSites.altitudeMeters,
            difficulty: diveSites.difficulty,
            rating: diveSites.rating,
            notes: diveSites.notes,
          },
          shopName: shops.name,
          diveTypeName: diveTypes.name,
        })
        .from(dives)
        .leftJoin(divers, eq(dives.diverId, divers.id))
        .leftJoin(diveSites, eq(dives.siteId, diveSites.id))
        .leftJoin(shops, eq(dives.shopId, shops.id))
        .leftJoin(diveTypes, eq(dives.diveTypeId, diveTypes.id))
        .where(eq(dives.id, diveId))
        .limit(1)

      if (!dive) return null

      const diveBuddiesData = await transaction
        .select({
          id: buddies.id,
          firstName: buddies.firstName,
          lastName: buddies.lastName,
          email: buddies.email,
          city: buddies.city,
          country: buddies.country,
        })
        .from(diveBuddies)
        .innerJoin(buddies, eq(diveBuddies.buddyId, buddies.id))
        .where(eq(diveBuddies.diveId, diveId))
        .orderBy(asc(buddies.lastName), asc(buddies.firstName))

      const diveEquipmentData = await transaction
        .select({
          id: equipment.id,
          name: equipment.name,
          category: equipment.category,
          manufacturer: equipment.manufacturer,
          model: equipment.model,
        })
        .from(diveEquipment)
        .innerJoin(equipment, eq(diveEquipment.equipmentId, equipment.id))
        .where(eq(diveEquipment.diveId, diveId))
        .orderBy(asc(equipment.category), asc(equipment.name))

      const diveTanks = await transaction
        .select({
          id: tanks.id,
          name: tanks.name,
          sortOrder: tanks.sortOrder,
          computerTankNumber: tanks.computerTankNumber,
          tankType: tanks.tankType,
          volumeLiters: tanks.volumeLiters,
          startPressureBar: tanks.startPressureBar,
          endPressureBar: tanks.endPressureBar,
          oxygenPercent: tanks.oxygenPercent,
          heliumPercent: tanks.heliumPercent,
          breathingTimeSeconds: tanks.breathingTimeSeconds,
        })
        .from(tanks)
        .where(eq(tanks.diveId, diveId))
        .orderBy(asc(tanks.sortOrder))

      const profileSamples = await transaction
        .select({
          id: diveProfileSamples.id,
          sampleIndex: diveProfileSamples.sampleIndex,
          elapsedSeconds: diveProfileSamples.elapsedSeconds,
          depthMeters: diveProfileSamples.depthMeters,
          temperatureCelsius: diveProfileSamples.temperatureCelsius,
          pressureBar: diveProfileSamples.pressureBar,
          decoCeilingMeters: diveProfileSamples.decoCeilingMeters,
          tankNumber: diveProfileSamples.tankNumber,
        })
        .from(diveProfileSamples)
        .where(eq(diveProfileSamples.diveId, diveId))
        .orderBy(
          asc(diveProfileSamples.elapsedSeconds),
          asc(diveProfileSamples.sampleIndex),
        )

      return {
        ...dive,
        buddies: diveBuddiesData,
        equipment: diveEquipmentData,
        tanks: diveTanks,
        profileSamples,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
