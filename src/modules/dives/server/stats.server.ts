import '@tanstack/react-start/server-only'

import { asc, count, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  buddies,
  certifications,
  diveBuddies,
  diveProfileSamples,
  dives,
  tanks,
} from '@/db/schema'

const emptySummary = {
  totalDives: 0,
  totalSeconds: 0,
  longestSeconds: 0,
  averageSeconds: 0,
  maximumDepthMeters: null as string | null,
  averageMaximumDepthMeters: null as string | null,
  averageDepthMeters: null as string | null,
  decompressionDives: 0,
  averageWeightKg: null as string | null,
  minimumWaterTemperatureCelsius: null as string | null,
  firstDiveDate: null as string | null,
}

export async function loadStatistics() {
  const db = getDb()
  return db.transaction(
    async (transaction) => {
      const [
        summaryRows,
        sacRows,
        decoRows,
        mixtureRows,
        bestBuddies,
        certificationList,
        divesPerYear,
      ] = await Promise.all([
        transaction
          .select({
            totalDives: count(),
            totalSeconds: sql<number>`coalesce(sum(${dives.durationSeconds}), 0)::integer`,
            longestSeconds: sql<number>`coalesce(max(${dives.durationSeconds}), 0)::integer`,
            averageSeconds: sql<number>`coalesce(avg(nullif(${dives.durationSeconds}, 0)), 0)::integer`,
            maximumDepthMeters: sql<string | null>`max(${dives.maximumDepthMeters})`,
            averageMaximumDepthMeters: sql<
              string | null
            >`avg(${dives.maximumDepthMeters})`,
            averageDepthMeters: sql<string | null>`avg(${dives.averageDepthMeters})`,
            decompressionDives: sql<number>`(count(*) filter (where ${dives.decompressionDive}))::integer`,
            averageWeightKg: sql<string | null>`avg(${dives.weightKg})`,
            minimumWaterTemperatureCelsius: sql<
              string | null
            >`min(${dives.waterTemperatureCelsius})`,
            firstDiveDate: sql<string | null>`min(${dives.diveDate})`,
          })
          .from(dives),
        // Surface air consumption per dive: litres breathed from tanks with
        // known volume and pressures, normalised to surface pressure through
        // the dive's average depth, then averaged across dives.
        transaction.execute<{
          average_sac: string | null
          sac_deviation: string | null
          sac_dive_count: number
        }>(sql`
          select
            avg(per_dive.sac) as average_sac,
            stddev_samp(per_dive.sac) as sac_deviation,
            count(*)::integer as sac_dive_count
          from (
            select
              sum(
                (${tanks.startPressureBar} - ${tanks.endPressureBar})
                  * ${tanks.volumeLiters}
              )
                / ((${dives.durationSeconds} / 60.0)
                  * (1 + ${dives.averageDepthMeters} / 10.0)) as sac
            from ${tanks}
            inner join ${dives} on ${dives.id} = ${tanks.diveId}
            where ${tanks.volumeLiters} is not null
              and ${tanks.startPressureBar} is not null
              and ${tanks.endPressureBar} is not null
              and ${tanks.startPressureBar} > ${tanks.endPressureBar}
              and ${dives.durationSeconds} > 0
              and ${dives.averageDepthMeters} is not null
            group by ${dives.id}
          ) as per_dive
        `),
        // Time spent under a decompression ceiling, summed from profile
        // samples. Each sample covers the span until the next sample; spans
        // over ten minutes are treated as recording gaps and skipped.
        transaction.execute<{ deco_seconds: number }>(sql`
          select coalesce(sum(span.span_seconds), 0)::integer as deco_seconds
          from (
            select
              ${diveProfileSamples.decoCeilingMeters} as deco_ceiling_meters,
              lead(${diveProfileSamples.elapsedSeconds}) over (
                partition by ${diveProfileSamples.diveId}
                order by ${diveProfileSamples.elapsedSeconds},
                  ${diveProfileSamples.sampleIndex}
              ) - ${diveProfileSamples.elapsedSeconds} as span_seconds
            from ${diveProfileSamples}
          ) as span
          where span.deco_ceiling_meters > 0
            and span.span_seconds between 1 and 600
        `),
        transaction.execute<{
          oxygen_percent: number
          helium_percent: number
          tank_count: number
        }>(sql`
          select
            round(coalesce(${tanks.oxygenPercent}, 21))::integer as oxygen_percent,
            round(coalesce(${tanks.heliumPercent}, 0))::integer as helium_percent,
            count(*)::integer as tank_count
          from ${tanks}
          group by 1, 2
          order by count(*) desc, 1 asc
          limit 1
        `),
        transaction
          .select({
            id: buddies.id,
            firstName: buddies.firstName,
            lastName: buddies.lastName,
            diveCount: sql<number>`count(${diveBuddies.diveId})::integer`,
            picturePath: sql<string | null>`(
              select coalesce(p.thumbnail_storage_path, p.storage_path)
              from pictures p
              where p.buddy_id = ${buddies.id}
                and p.kind = 'photo'
                and p.storage_path is not null
              order by p.sort_order nulls last, p.path
              limit 1
            )`,
          })
          .from(diveBuddies)
          .innerJoin(buddies, eq(diveBuddies.buddyId, buddies.id))
          .groupBy(buddies.id)
          .orderBy(
            desc(sql`count(${diveBuddies.diveId})`),
            asc(buddies.lastName),
            asc(buddies.firstName),
          )
          .limit(1),
        transaction
          .select({
            id: certifications.id,
            name: certifications.name,
            organization: certifications.organization,
          })
          .from(certifications)
          .orderBy(asc(certifications.sortOrder), asc(certifications.certifiedAt)),
        transaction
          .select({
            year: sql<number>`extract(year from ${dives.diveDate})::integer`,
            diveCount: count(),
          })
          .from(dives)
          .groupBy(sql`extract(year from ${dives.diveDate})`)
          .orderBy(sql`extract(year from ${dives.diveDate})`),
      ])

      const sacRow = sacRows[0]
      const mixtureRow = mixtureRows[0]

      return {
        summary: summaryRows[0] ?? emptySummary,
        sac: {
          average: sacRow?.average_sac ?? null,
          deviation: sacRow?.sac_deviation ?? null,
          diveCount: sacRow?.sac_dive_count ?? 0,
        },
        decoSeconds: decoRows[0]?.deco_seconds ?? 0,
        preferredMixture: mixtureRow
          ? {
              oxygenPercent: mixtureRow.oxygen_percent,
              heliumPercent: mixtureRow.helium_percent,
              tankCount: mixtureRow.tank_count,
            }
          : null,
        bestBuddy: bestBuddies[0] ?? null,
        certifications: certificationList,
        divesPerYear,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
