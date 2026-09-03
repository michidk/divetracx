import '@tanstack/react-start/server-only'

import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
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
  externalRecordLinks,
  externalRecords,
  pictures,
  shops,
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
      sitesVisited: sql<number>`count(distinct ${dives.siteId})::integer`,
      siteCount: sql<number>`(select count(*) from ${diveSites})::integer`,
      buddyCount: sql<number>`(select count(*) from ${buddies})::integer`,
      gearCount: sql<number>`(select count(*) from ${equipment} where not ${equipment.inactive})::integer`,
      certificationCount: sql<number>`(select count(*) from certifications)::integer`,
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
      diveTypeName: diveTypes.name,
      picturePath: sql<string | null>`(
        select coalesce(p.thumbnail_storage_path, p.storage_path)
        from pictures p
        where p.dive_id = ${dives.id}
          and p.kind = 'photo'
          and p.storage_path is not null
        order by p.sort_order nulls last, p.path
        limit 1
      )`,
    })
    .from(dives)
    .leftJoin(diveSites, sql`${dives.siteId} = ${diveSites.id}`)
    .leftJoin(diveTypes, eq(dives.diveTypeId, diveTypes.id))
    .orderBy(desc(dives.diveDate), desc(dives.entryTime))
    .limit(6)

  return {
    summary: summary ?? {
      totalDives: 0,
      totalSeconds: 0,
      deepestMeters: '0',
      latestDiveDate: null,
      sitesVisited: 0,
      siteCount: 0,
      buddyCount: 0,
      gearCount: 0,
      certificationCount: 0,
    },
    recentDives,
  }
}

const DIVES_PAGE_SIZE = 50

export async function loadDives(search: string, requestedPage: number) {
  const db = getDb()
  const query = search.trim()
  const filter = query
    ? sql`(
        ${diveSites.name} ilike ${`%${query}%`}
        or ${diveSites.country} ilike ${`%${query}%`}
        or ${dives.diveDate}::text ilike ${`%${query}%`}
        or ${dives.number}::text = ${query.replace(/^#/, '')}
      )`
    : sql`true`

  const [totals] = await db
    .select({ total: count() })
    .from(dives)
    .leftJoin(diveSites, sql`${dives.siteId} = ${diveSites.id}`)
    .where(filter)
  const total = totals?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / DIVES_PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), pageCount)

  const records = await db
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
      diveTypeName: diveTypes.name,
      decompressionDive: dives.decompressionDive,
      picturePath: sql<string | null>`(
        select coalesce(p.thumbnail_storage_path, p.storage_path)
        from pictures p
        where p.dive_id = ${dives.id}
          and p.kind = 'photo'
          and p.storage_path is not null
        order by p.sort_order nulls last, p.path
        limit 1
      )`,
    })
    .from(dives)
    .leftJoin(diveSites, sql`${dives.siteId} = ${diveSites.id}`)
    .leftJoin(diveTypes, eq(dives.diveTypeId, diveTypes.id))
    .where(filter)
    .orderBy(desc(dives.diveDate), desc(dives.entryTime))
    .limit(DIVES_PAGE_SIZE)
    .offset((page - 1) * DIVES_PAGE_SIZE)

  return { records, total, page, pageCount, pageSize: DIVES_PAGE_SIZE }
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
          equipmentWeightKg: dives.equipmentWeightKg,
          maximumPpo2: dives.maximumPpo2,
          decompressionDive: dives.decompressionDive,
          waterType: dives.waterType,
          entryType: dives.entryType,
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
          volumeLiters: tanks.volumeLiters,
          startPressureBar: tanks.startPressureBar,
          endPressureBar: tanks.endPressureBar,
          workingPressureBar: tanks.workingPressureBar,
          oxygenPercent: tanks.oxygenPercent,
          heliumPercent: tanks.heliumPercent,
          breathingTimeSeconds: tanks.breathingTimeSeconds,
          weightKg: tanks.weightKg,
        })
        .from(tanks)
        .where(eq(tanks.diveId, diveId))
        .orderBy(asc(tanks.sortOrder))

      const divePictures = await transaction
        .select({
          id: pictures.id,
          kind: pictures.kind,
          path: pictures.path,
          storagePath: pictures.storagePath,
          thumbnailStoragePath: pictures.thumbnailStoragePath,
          mimeType: pictures.mimeType,
          description: pictures.description,
          sortOrder: pictures.sortOrder,
        })
        .from(pictures)
        .where(eq(pictures.diveId, diveId))
        .orderBy(asc(pictures.sortOrder), asc(pictures.path))

      const profileSamples = await transaction
        .select({
          id: diveProfileSamples.id,
          sampleIndex: diveProfileSamples.sampleIndex,
          elapsedSeconds: diveProfileSamples.elapsedSeconds,
          depthMeters: diveProfileSamples.depthMeters,
          temperatureCelsius: diveProfileSamples.temperatureCelsius,
          pressureBar: diveProfileSamples.pressureBar,
          tank1PressureBar: diveProfileSamples.tank1PressureBar,
          tank2PressureBar: diveProfileSamples.tank2PressureBar,
          decoCeilingMeters: diveProfileSamples.decoCeilingMeters,
          tankNumber: diveProfileSamples.tankNumber,
        })
        .from(diveProfileSamples)
        .where(eq(diveProfileSamples.diveId, diveId))
        .orderBy(
          asc(diveProfileSamples.elapsedSeconds),
          asc(diveProfileSamples.sampleIndex),
        )

      const sources = await transaction
        .select({
          integrationKey: externalRecords.integrationKey,
          externalId: externalRecords.externalId,
          identityKey: externalRecords.identityKey,
          externalUpdatedAt: externalRecords.externalUpdatedAt,
          lastSeenAt: externalRecords.lastSeenAt,
        })
        .from(externalRecordLinks)
        .innerJoin(
          externalRecords,
          eq(externalRecordLinks.externalRecordId, externalRecords.id),
        )
        .where(
          and(
            eq(externalRecordLinks.canonicalEntityType, 'dive'),
            eq(externalRecordLinks.canonicalEntityId, diveId),
          ),
        )

      return {
        ...dive,
        buddies: diveBuddiesData,
        equipment: diveEquipmentData,
        tanks: diveTanks,
        photos: divePictures.filter((picture) => picture.kind === 'photo'),
        signatures: divePictures.filter((picture) => picture.kind === 'signature'),
        profileSamples,
        sources,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
