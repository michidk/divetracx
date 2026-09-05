import '@tanstack/react-start/server-only'

import { and, asc, eq, inArray, max, ne, sql } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import { getDb } from '@/db'
import {
  diveBuddies,
  diveEquipment,
  diveMerges,
  diveProfileSamples,
  diveSites,
  dives,
  diveTypes,
  externalRecordLinks,
  pictures,
  tanks,
} from '@/db/schema'
import { MATCHED_LINK_ROLE } from '@/modules/integrations/types'
import {
  DiveMergeError,
  type MergeDiveInput,
  type MergeSample,
  type MergeTank,
  mergeTanks,
  planDiveMerge,
  summariseProfile,
} from '../merge'

const CANDIDATE_DAYS = 1

const diveColumns = {
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
  visibility: dives.visibility,
  current: dives.current,
  waves: dives.waves,
  weather: dives.weather,
  waterType: dives.waterType,
  entryType: dives.entryType,
  rating: dives.rating,
  computer: dives.computer,
  suit: dives.suit,
  notes: dives.notes,
  siteId: dives.siteId,
  siteName: diveSites.name,
  shopId: dives.shopId,
  boatId: dives.boatId,
  diveTypeId: dives.diveTypeId,
  diverId: dives.diverId,
}

interface LoadedDive {
  dive: MergeDiveInput
  samples: MergeSample[]
  tanks: MergeTank[]
}

async function loadDivesForMerge(
  transaction: DatabaseTransaction,
  diveIds: string[],
): Promise<Map<string, LoadedDive>> {
  const rows = await transaction
    .select(diveColumns)
    .from(dives)
    .leftJoin(diveSites, eq(dives.siteId, diveSites.id))
    .where(inArray(dives.id, diveIds))
  const sampleRows = await transaction
    .select({
      diveId: diveProfileSamples.diveId,
      elapsedSeconds: diveProfileSamples.elapsedSeconds,
      depthMeters: diveProfileSamples.depthMeters,
    })
    .from(diveProfileSamples)
    .where(inArray(diveProfileSamples.diveId, diveIds))
    .orderBy(asc(diveProfileSamples.elapsedSeconds), asc(diveProfileSamples.sampleIndex))
  const tankRows = await transaction
    .select({
      diveId: tanks.diveId,
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
    .where(inArray(tanks.diveId, diveIds))
    .orderBy(asc(tanks.sortOrder))

  const loaded = new Map<string, LoadedDive>()
  for (const dive of rows) loaded.set(dive.id, { dive, samples: [], tanks: [] })
  for (const sample of sampleRows) loaded.get(sample.diveId)?.samples.push(sample)
  for (const { diveId, ...tank } of tankRows) loaded.get(diveId)?.tanks.push(tank)
  return loaded
}

/**
 * Dives close enough to the given one to plausibly be the same dive split by a
 * computer. A day either side rather than the same date, so a dive that ran
 * past midnight still finds its other half.
 */
export async function loadMergeCandidates(diveId: string) {
  const db = getDb()
  return db.transaction(
    async (transaction) => {
      const [target] = await transaction
        .select({ diveDate: dives.diveDate })
        .from(dives)
        .where(eq(dives.id, diveId))
        .limit(1)
      if (!target) return null

      const candidates = await transaction
        .select({
          id: dives.id,
          number: dives.number,
          diveDate: dives.diveDate,
          entryTime: dives.entryTime,
          durationSeconds: dives.durationSeconds,
          maximumDepthMeters: dives.maximumDepthMeters,
          siteName: diveSites.name,
          diveTypeName: diveTypes.name,
          sampleCount: sql<number>`(
            select count(*) from ${diveProfileSamples}
            where ${diveProfileSamples.diveId} = ${dives.id}
          )::integer`,
        })
        .from(dives)
        .leftJoin(diveSites, eq(dives.siteId, diveSites.id))
        .leftJoin(diveTypes, eq(dives.diveTypeId, diveTypes.id))
        .where(
          and(
            ne(dives.id, diveId),
            // The day offsets need an explicit integer cast: an untyped
            // parameter lets Postgres resolve `date - date`, which yields a
            // number rather than a date.
            sql`${dives.diveDate} between ${target.diveDate}::date - ${CANDIDATE_DAYS}::integer and ${target.diveDate}::date + ${CANDIDATE_DAYS}::integer`,
          ),
        )
        .orderBy(asc(dives.diveDate), asc(dives.entryTime))

      return { diveDate: target.diveDate, candidates }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}

export interface MergePreview {
  /** The dive that survives, which may not be the one being viewed. */
  keeperDiveId: string | null
  keeperLabel: string | null
  segments: Array<{
    diveId: string
    label: string
    offsetSeconds: number
    gapSeconds: number
    isKeeper: boolean
  }>
  durationSeconds: number
  maximumDepthMeters: string | null
  averageDepthMeters: string | null
  tanksCombined: number
  tanksAppended: number
  tanksBeyondChartSlots: number
  samplesMoved: number
  photosMoved: number
  error: string | null
}

function emptyPreview(error: string | null): MergePreview {
  return {
    keeperDiveId: null,
    keeperLabel: null,
    segments: [],
    durationSeconds: 0,
    maximumDepthMeters: null,
    averageDepthMeters: null,
    tanksCombined: 0,
    tanksAppended: 0,
    tanksBeyondChartSlots: 0,
    samplesMoved: 0,
    photosMoved: 0,
    error,
  }
}

/**
 * What the merge would do, computed exactly the way it will be carried out so
 * the review step cannot disagree with the result.
 */
export async function previewDiveMerge(
  targetDiveId: string,
  sourceDiveIds: string[],
): Promise<MergePreview> {
  const db = getDb()
  return db.transaction(
    async (transaction) => {
      const loaded = await loadDivesForMerge(transaction, [
        targetDiveId,
        ...sourceDiveIds,
      ])
      const target = loaded.get(targetDiveId)
      if (!target) return emptyPreview('The dive was not found')
      const sources = sourceDiveIds.map((id) => loaded.get(id))
      if (sources.some((source) => !source)) {
        return emptyPreview('One of the selected dives was not found')
      }
      const present = sources.filter((source): source is LoadedDive => Boolean(source))

      let plan: ReturnType<typeof planDiveMerge>
      try {
        plan = planDiveMerge([target, ...present])
      } catch (error) {
        if (error instanceof DiveMergeError) return emptyPreview(error.message)
        throw error
      }

      let combined = 0
      let appended = 0
      let beyondChartSlots = 0
      let targetTanks = loaded.get(plan.keeperId)?.tanks ?? []
      for (const segment of plan.segments) {
        if (segment.dive.id === plan.keeperId) continue
        const source = loaded.get(segment.dive.id)
        if (!source) continue
        const result = mergeTanks(targetTanks, source.tanks)
        combined += result.combined.length
        appended += result.appended.length
        beyondChartSlots += result.appended.filter((tank) => tank.beyondChartSlots).length
        targetTanks = [
          ...targetTanks,
          ...result.appended.map((entry) => {
            const tank = source.tanks.find((item) => item.id === entry.sourceTankId)
            if (!tank) throw new Error('Appended tank vanished from the merge')
            return { ...tank, computerTankNumber: entry.computerTankNumber }
          }),
        ]
      }

      const removedIds = [targetDiveId, ...sourceDiveIds].filter(
        (id) => id !== plan.keeperId,
      )
      const [photos] = await transaction
        .select({ total: sql<number>`count(*)::integer` })
        .from(pictures)
        .where(inArray(pictures.diveId, removedIds))
      return {
        keeperDiveId: plan.keeperId,
        keeperLabel:
          plan.segments.find((segment) => segment.dive.id === plan.keeperId)?.label ??
          null,
        segments: plan.segments.map((segment) => ({
          diveId: segment.dive.id,
          label: segment.label,
          offsetSeconds: segment.offsetSeconds,
          gapSeconds: segment.gapSeconds,
          isKeeper: segment.dive.id === plan.keeperId,
        })),
        durationSeconds: plan.durationSeconds,
        maximumDepthMeters: plan.fields.maximumDepthMeters,
        averageDepthMeters: plan.fields.averageDepthMeters,
        tanksCombined: combined,
        tanksAppended: appended,
        tanksBeyondChartSlots: beyondChartSlots,
        samplesMoved: removedIds.reduce(
          (total, id) => total + (loaded.get(id)?.samples.length ?? 0),
          0,
        ),
        photosMoved: photos?.total ?? 0,
        error: null,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}

/**
 * Move a source dive's samples onto the merged timeline. The tank remap is
 * normally the identity — a split dive keeps breathing the same cylinders — but
 * an appended tank that had to take a different slot needs its samples' tank
 * number and pressure column moved with it.
 */
function moveSamples(
  transaction: DatabaseTransaction,
  sourceDiveId: string,
  keeperId: string,
  offsetSeconds: number,
  segmentIndexes: Map<number, number>,
  tankNumberMap: Map<number, number>,
) {
  const remapped = (slot: number) => {
    const source = [...tankNumberMap].find(([, to]) => to === slot)?.[0]
    if (source === undefined) return sql`null`
    return source === 1
      ? diveProfileSamples.tank1PressureBar
      : source === 2
        ? diveProfileSamples.tank2PressureBar
        : sql`null`
  }
  const identityTanks = [...tankNumberMap].every(([from, to]) => from === to)

  return transaction
    .update(diveProfileSamples)
    .set({
      diveId: keeperId,
      elapsedSeconds: sql`${diveProfileSamples.elapsedSeconds} + ${offsetSeconds}`,
      segmentIndex: sql`case ${diveProfileSamples.segmentIndex} ${sql.join(
        [...segmentIndexes].map(([from, to]) => sql`when ${from} then ${to}`),
        sql` `,
      )} else ${diveProfileSamples.segmentIndex} end`,
      ...(identityTanks
        ? {}
        : {
            tankNumber: sql`case ${diveProfileSamples.tankNumber} ${sql.join(
              [...tankNumberMap].map(([from, to]) => sql`when ${from} then ${to}`),
              sql` `,
            )} else ${diveProfileSamples.tankNumber} end`,
            tank1PressureBar: remapped(1),
            tank2PressureBar: remapped(2),
          }),
    })
    .where(eq(diveProfileSamples.diveId, sourceDiveId))
}

/**
 * Hand the source dives' provenance to the keeper. Their dive links are
 * re-pointed at it in the matched role, which is how this codebase already
 * marks a canonical record an integration references but does not own: the
 * source is never recreated, and the keeper is enriched rather than rewritten.
 * The derived links go, because the rows they name have moved into the keeper
 * and must not be replaced out from under it on the next run.
 */
async function reassignSourceProvenance(
  transaction: DatabaseTransaction,
  sourceDiveIds: string[],
  targetDiveId: string,
) {
  const links = await transaction
    .select({ externalRecordId: externalRecordLinks.externalRecordId })
    .from(externalRecordLinks)
    .where(
      and(
        eq(externalRecordLinks.canonicalEntityType, 'dive'),
        inArray(externalRecordLinks.canonicalEntityId, sourceDiveIds),
      ),
    )
  const externalRecordIds = [...new Set(links.map((link) => link.externalRecordId))]
  if (externalRecordIds.length === 0) return

  await transaction
    .delete(externalRecordLinks)
    .where(inArray(externalRecordLinks.externalRecordId, externalRecordIds))
  await transaction
    .insert(externalRecordLinks)
    .values(
      externalRecordIds.map((externalRecordId) => ({
        externalRecordId,
        canonicalEntityType: 'dive',
        canonicalEntityId: targetDiveId,
        role: MATCHED_LINK_ROLE,
      })),
    )
    .onConflictDoNothing()
}

/**
 * Fold the source dives into the target and delete them. The target keeps its
 * id, dive number, and existing segment numbering; merged-in profiles are
 * appended as further segments and the whole timeline is re-sequenced.
 */
export async function mergeDivesInto(targetDiveId: string, sourceDiveIds: string[]) {
  if (sourceDiveIds.length === 0) {
    throw new DiveMergeError('Select at least one dive to merge in')
  }
  if (sourceDiveIds.includes(targetDiveId)) {
    throw new DiveMergeError('A dive cannot be merged into itself')
  }

  return getDb().transaction(async (transaction) => {
    const ids = [targetDiveId, ...sourceDiveIds]
    const loaded = await loadDivesForMerge(transaction, ids)
    const entries = ids.map((id) => {
      const entry = loaded.get(id)
      if (!entry) throw new DiveMergeError('One of the selected dives was not found')
      return entry
    })

    // The dive that survives is the earliest one, which is not necessarily the
    // one the merge was started from.
    const plan = planDiveMerge(entries)
    const keeperId = plan.keeperId
    const keeper = loaded.get(keeperId)
    if (!keeper) throw new DiveMergeError('The dive was not found')
    const removedIds = ids.filter((id) => id !== keeperId)

    const [existingSegments] = await transaction
      .select({ highest: max(diveProfileSamples.segmentIndex) })
      .from(diveProfileSamples)
      .where(eq(diveProfileSamples.diveId, keeperId))
    let nextSegmentIndex = (existingSegments?.highest ?? 0) + 1

    const mergeRows: Array<typeof diveMerges.$inferInsert> = []

    let targetTanks = keeper.tanks
    let photoSortOrder = await nextPhotoSortOrder(transaction, keeperId)

    for (const segment of plan.segments) {
      if (segment.dive.id === keeperId) continue
      const source = loaded.get(segment.dive.id)
      if (!source) continue

      const tankResult = mergeTanks(targetTanks, source.tanks)
      const tankNumberMap = new Map<number, number>()

      for (const combination of tankResult.combined) {
        const sourceTank = source.tanks.find(
          (tank) => tank.id === combination.sourceTankId,
        )
        const targetTank = targetTanks.find(
          (tank) => tank.id === combination.targetTankId,
        )
        if (
          sourceTank?.computerTankNumber != null &&
          targetTank?.computerTankNumber != null
        ) {
          tankNumberMap.set(sourceTank.computerTankNumber, targetTank.computerTankNumber)
        }
        await transaction
          .update(tanks)
          .set({
            endPressureBar: combination.endPressureBar,
            breathingTimeSeconds: combination.breathingTimeSeconds,
            updatedAt: new Date(),
          })
          .where(eq(tanks.id, combination.targetTankId))
        if (targetTank) targetTank.endPressureBar = combination.endPressureBar
      }

      for (const entry of tankResult.appended) {
        const sourceTank = source.tanks.find((tank) => tank.id === entry.sourceTankId)
        if (sourceTank?.computerTankNumber != null && entry.computerTankNumber !== null) {
          tankNumberMap.set(sourceTank.computerTankNumber, entry.computerTankNumber)
        }
        await transaction
          .update(tanks)
          .set({
            diveId: keeperId,
            sortOrder: entry.sortOrder,
            computerTankNumber: entry.computerTankNumber,
            updatedAt: new Date(),
          })
          .where(eq(tanks.id, entry.sourceTankId))
        if (sourceTank) {
          targetTanks = [
            ...targetTanks,
            { ...sourceTank, computerTankNumber: entry.computerTankNumber },
          ]
        }
      }

      // A source that was itself merged before brings several segments with
      // it; each keeps its own boundary under a fresh index.
      const sourceSegments = await transaction
        .selectDistinct({ segmentIndex: diveProfileSamples.segmentIndex })
        .from(diveProfileSamples)
        .where(eq(diveProfileSamples.diveId, segment.dive.id))
        .orderBy(asc(diveProfileSamples.segmentIndex))
      // A dive with no profile still reserves an index, and still needs a
      // mapping so the statement stays valid SQL even though it matches no rows.
      const segmentIndexes = new Map(
        (sourceSegments.length > 0 ? sourceSegments : [{ segmentIndex: 0 }]).map(
          (row, offset) => [row.segmentIndex, nextSegmentIndex + offset],
        ),
      )
      nextSegmentIndex += segmentIndexes.size

      await moveSamples(
        transaction,
        segment.dive.id,
        keeperId,
        segment.offsetSeconds,
        segmentIndexes,
        tankNumberMap,
      )

      // Buddies and gear are unioned; the unique indexes drop what the merged
      // dive already lists, and a clash of roles leaves the keeper's in place.
      const sourceBuddies = await transaction
        .select({ buddyId: diveBuddies.buddyId, role: diveBuddies.role })
        .from(diveBuddies)
        .where(eq(diveBuddies.diveId, segment.dive.id))
      if (sourceBuddies.length > 0) {
        await transaction
          .insert(diveBuddies)
          .values(sourceBuddies.map((buddy) => ({ ...buddy, diveId: keeperId })))
          .onConflictDoNothing()
      }

      const sourceEquipment = await transaction
        .select({ equipmentId: diveEquipment.equipmentId })
        .from(diveEquipment)
        .where(eq(diveEquipment.diveId, segment.dive.id))
      if (sourceEquipment.length > 0) {
        await transaction
          .insert(diveEquipment)
          .values(sourceEquipment.map((item) => ({ ...item, diveId: keeperId })))
          .onConflictDoNothing()
      }

      const movedPhotos = await transaction
        .update(pictures)
        .set({
          diveId: keeperId,
          sortOrder: sql`coalesce(${pictures.sortOrder}, 0) + ${photoSortOrder}`,
          updatedAt: new Date(),
        })
        .where(eq(pictures.diveId, segment.dive.id))
        .returning({ id: pictures.id })
      photoSortOrder += movedPhotos.length

      mergeRows.push({
        targetDiveId: keeperId,
        segmentIndex: segment.segmentIndex,
        offsetSeconds: segment.offsetSeconds,
        sourceDiveId: segment.dive.id,
        sourceLabel: segment.label,
      })
    }

    if (mergeRows.length > 0) await transaction.insert(diveMerges).values(mergeRows)
    // A dive that was merged into this one earlier hands its own segment list
    // over too, so the surviving dive lists everything it is made of.
    await transaction
      .update(diveMerges)
      .set({ targetDiveId: keeperId })
      .where(inArray(diveMerges.targetDiveId, removedIds))
    await reassignSourceProvenance(transaction, removedIds, keeperId)

    await transaction
      .update(dives)
      .set({ ...plan.fields, updatedAt: new Date() })
      .where(eq(dives.id, keeperId))
    await transaction.delete(dives).where(inArray(dives.id, removedIds))

    await resequenceSamples(transaction, keeperId)

    return { diveId: keeperId, mergedCount: removedIds.length }
  })
}

async function nextPhotoSortOrder(
  transaction: DatabaseTransaction,
  targetDiveId: string,
) {
  const [row] = await transaction
    .select({ highest: max(pictures.sortOrder) })
    .from(pictures)
    .where(eq(pictures.diveId, targetDiveId))
  return (row?.highest ?? -1) + 1
}

/** Renumber a dive's samples so `sampleIndex` follows the merged timeline. */
async function resequenceSamples(transaction: DatabaseTransaction, targetDiveId: string) {
  await transaction.execute(sql`
    with ordered as (
      select id, (row_number() over (
        order by elapsed_seconds, segment_index, sample_index
      ) - 1)::integer as position
      from dive_profile_samples
      where dive_id = ${targetDiveId}
    )
    update dive_profile_samples
    set sample_index = ordered.position
    from ordered
    where dive_profile_samples.id = ordered.id
      and dive_profile_samples.sample_index is distinct from ordered.position
  `)
}

/**
 * Put a merged dive's derived scalars back in step with its profile.
 *
 * A merged dive stays a normal dive, so an import that finds its record changed
 * upstream rewrites the scalars — from one segment's worth of data, because
 * that is all the source knows about. The samples of the segments it absorbed
 * are still there, so the duration and depths are recomputed over the whole
 * profile rather than left contradicting the chart.
 */
export async function restoreMergedDiveProfiles(transaction: DatabaseTransaction) {
  const merged = await transaction
    .selectDistinct({ diveId: diveMerges.targetDiveId })
    .from(diveMerges)
  if (merged.length === 0) return 0

  const diveIds = merged.map((row) => row.diveId)
  const samples = await transaction
    .select({
      diveId: diveProfileSamples.diveId,
      segmentIndex: diveProfileSamples.segmentIndex,
      elapsedSeconds: diveProfileSamples.elapsedSeconds,
      depthMeters: diveProfileSamples.depthMeters,
    })
    .from(diveProfileSamples)
    .where(inArray(diveProfileSamples.diveId, diveIds))
    .orderBy(asc(diveProfileSamples.elapsedSeconds), asc(diveProfileSamples.sampleIndex))

  const byDive = new Map<string, typeof samples>()
  for (const sample of samples) {
    const run = byDive.get(sample.diveId) ?? []
    run.push(sample)
    byDive.set(sample.diveId, run)
  }

  let restored = 0
  for (const diveId of diveIds) {
    const summary = summariseProfile(byDive.get(diveId) ?? [])
    if (!summary) continue
    const [row] = await transaction
      .update(dives)
      .set(summary)
      .where(
        and(
          eq(dives.id, diveId),
          // Only touch a dive an import actually moved out of step.
          ne(dives.durationSeconds, summary.durationSeconds),
        ),
      )
      .returning({ id: dives.id })
    if (row) restored += 1
  }
  return restored
}

/** Segments a dive absorbed, for the provenance panel on the dive page. */
export async function loadDiveMerges(
  transaction: DatabaseTransaction,
  targetDiveId: string,
) {
  return transaction
    .select({
      segmentIndex: diveMerges.segmentIndex,
      offsetSeconds: diveMerges.offsetSeconds,
      sourceLabel: diveMerges.sourceLabel,
      mergedAt: diveMerges.mergedAt,
    })
    .from(diveMerges)
    .where(eq(diveMerges.targetDiveId, targetDiveId))
    .orderBy(asc(diveMerges.segmentIndex))
}
