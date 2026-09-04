import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import {
  diveProfileSamples,
  dives,
  externalRecordLinks,
  externalRecords,
  tanks,
} from '@/db/schema'
import {
  type ExternalRecordInput,
  type IntegrationConnector,
  MATCHED_LINK_ROLE,
} from '@/modules/integrations/types'
import { parseGarminActivityDetails } from '../activity-details'
import { mapGarminActivity } from '../mapping'
import { adjacentDiveDates, selectNearestDive } from '../matching'
import type {
  GarminMappedDive,
  GarminSourceActivity,
  GarminSourceBatch,
  GarminSourceClient,
} from '../types'
import { createGarminSourceClient } from './client.server'

const SOURCE_KEY = 'garmin'

interface PreparedGarminActivity {
  source: GarminSourceActivity
  mapped: GarminMappedDive | null
}

interface PreparedGarminData {
  activities: Map<string, PreparedGarminActivity>
}

function numeric(value: number | null) {
  return value === null ? null : String(value)
}

function validDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function garminDiveValues(mapped: GarminMappedDive) {
  return {
    captureSource: 'computer' as const,
    number: mapped.number,
    diveDate: mapped.diveDate,
    entryTime: mapped.entryTime,
    utcOffsetMinutes: mapped.utcOffsetMinutes,
    durationSeconds: mapped.durationSeconds,
    surfaceIntervalSeconds: mapped.surfaceIntervalSeconds,
    maximumDepthMeters: numeric(mapped.maximumDepthMeters),
    averageDepthMeters: numeric(mapped.averageDepthMeters),
    waterTemperatureCelsius: numeric(mapped.waterTemperatureCelsius),
    maximumPpo2: numeric(mapped.maximumPpo2),
    computer: mapped.computer,
    notes: mapped.notes,
    updatedAt: new Date(),
  }
}

/**
 * A matched log entry stays authoritative: Garmin values only fill fields the
 * dive does not have yet, and the dive is marked as computer-captured.
 */
async function enrichMatchedDive(
  transaction: DatabaseTransaction,
  diveId: string,
  mapped: GarminMappedDive,
) {
  const [current] = await transaction
    .select({
      durationSeconds: dives.durationSeconds,
      surfaceIntervalSeconds: dives.surfaceIntervalSeconds,
      maximumDepthMeters: dives.maximumDepthMeters,
      averageDepthMeters: dives.averageDepthMeters,
      waterTemperatureCelsius: dives.waterTemperatureCelsius,
      maximumPpo2: dives.maximumPpo2,
      utcOffsetMinutes: dives.utcOffsetMinutes,
      computer: dives.computer,
    })
    .from(dives)
    .where(eq(dives.id, diveId))
    .limit(1)
  if (!current) {
    throw new Error(`Matched dive ${diveId} for Garmin ${mapped.externalId} is missing`)
  }
  await transaction
    .update(dives)
    .set({
      captureSource: 'computer' as const,
      updatedAt: new Date(),
      ...(current.durationSeconds > 0 ? {} : { durationSeconds: mapped.durationSeconds }),
      ...(current.surfaceIntervalSeconds === null
        ? { surfaceIntervalSeconds: mapped.surfaceIntervalSeconds }
        : {}),
      ...(current.maximumDepthMeters === null
        ? { maximumDepthMeters: numeric(mapped.maximumDepthMeters) }
        : {}),
      ...(current.averageDepthMeters === null
        ? { averageDepthMeters: numeric(mapped.averageDepthMeters) }
        : {}),
      ...(current.waterTemperatureCelsius === null
        ? { waterTemperatureCelsius: numeric(mapped.waterTemperatureCelsius) }
        : {}),
      ...(current.maximumPpo2 === null
        ? { maximumPpo2: numeric(mapped.maximumPpo2) }
        : {}),
      ...(current.utcOffsetMinutes === null
        ? { utcOffsetMinutes: mapped.utcOffsetMinutes }
        : {}),
      ...(current.computer === null ? { computer: mapped.computer } : {}),
    })
    .where(eq(dives.id, diveId))
}

async function diveHasProfileSamples(transaction: DatabaseTransaction, diveId: string) {
  const [row] = await transaction
    .select({ id: diveProfileSamples.id })
    .from(diveProfileSamples)
    .where(eq(diveProfileSamples.diveId, diveId))
    .limit(1)
  return Boolean(row)
}

async function diveHasTanks(transaction: DatabaseTransaction, diveId: string) {
  const [row] = await transaction
    .select({ id: tanks.id })
    .from(tanks)
    .where(eq(tanks.diveId, diveId))
    .limit(1)
  return Boolean(row)
}

function prepareBatch(batch: GarminSourceBatch) {
  const activities = new Map<string, PreparedGarminActivity>()
  const records: ExternalRecordInput[] = []
  for (const source of batch.activities) {
    const details = parseGarminActivityDetails(source.activityDetails)
    if (activities.has(details.activityId)) {
      throw new Error(`Garmin batch contains duplicate activity ${details.activityId}`)
    }
    const mapped = mapGarminActivity(source)
    const fitChecksum = source.fitBytes
      ? createHash('sha256').update(source.fitBytes).digest('hex')
      : null
    activities.set(details.activityId, { source, mapped })
    records.push({
      entityType: 'activity',
      identityKey: details.activityId,
      externalId: details.activityId,
      rawPayload: details.raw,
      fileMetadata: fitChecksum
        ? {
            checksum: fitChecksum,
            byteSize: source.fitBytes?.byteLength ?? 0,
            fileName: source.fitFileName ?? null,
            contentType: source.fitContentType ?? 'application/vnd.ant.fit',
          }
        : null,
      externalUpdatedAt: validDate(details.insertedDate),
      mapperVersion: 1,
    })
  }
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify(
        records.map((record) => [
          record.identityKey,
          record.rawPayload,
          record.fileMetadata,
        ]),
      ),
    )
    .digest('hex')
  return { activities, records, fingerprint }
}

export function createGarminConnector(
  client: GarminSourceClient = createGarminSourceClient(),
): IntegrationConnector<PreparedGarminData> {
  return {
    descriptor: {
      key: SOURCE_KEY,
      displayName: 'Garmin',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['dives', 'profile_samples', 'tanks', 'gases'],
    },
    async prepareImport(context) {
      const batch =
        context.mode === 'full'
          ? await client.fetchFull(context.state, context.signal)
          : await client.fetchIncremental(context.state, context.signal)
      context.signal.throwIfAborted()
      const prepared = prepareBatch(batch)
      return {
        records: prepared.records,
        data: { activities: prepared.activities },
        nextState: batch.nextState,
        validation: {
          complete: batch.complete ?? true,
          sourceDescription: batch.sourceDescription,
        },
        sourceFingerprint: prepared.fingerprint,
        diagnostics: {
          ...(batch.diagnostics ?? {}),
          activitiesReceived: batch.activities.length,
          divesReceived: [...prepared.activities.values()].filter((item) => item.mapped)
            .length,
        },
      }
    },
    async applyImport(context) {
      let created = 0
      let updated = 0
      let skipped = 0
      let matched = 0
      let profileSamplesCreated = 0
      let tanksCreated = 0

      // Dives that already carry a Garmin activity must not be matched again
      // by a second activity in this or a later run.
      const linkedDives = await context.transaction
        .select({ diveId: externalRecordLinks.canonicalEntityId })
        .from(externalRecordLinks)
        .innerJoin(
          externalRecords,
          eq(externalRecordLinks.externalRecordId, externalRecords.id),
        )
        .where(
          and(
            eq(externalRecords.integrationKey, SOURCE_KEY),
            eq(externalRecordLinks.canonicalEntityType, 'dive'),
          ),
        )
      const reservedDiveIds = new Set(linkedDives.map((row) => row.diveId))

      for (const record of context.records) {
        context.signal.throwIfAborted()
        if (record.change === 'unchanged') {
          skipped += 1
          continue
        }
        const activity = context.prepared.data.activities.get(record.input.identityKey)
        if (!activity) {
          throw new Error(
            `Prepared Garmin activity ${record.input.identityKey} is missing`,
          )
        }
        const mapped = activity.mapped
        if (!mapped) {
          skipped += 1
          continue
        }

        const diveLink = record.canonicalLinks.find(
          (link) => link.canonicalEntityType === 'dive',
        )
        let diveId = diveLink?.canonicalEntityId ?? null
        let ownsDive = diveLink ? diveLink.role !== MATCHED_LINK_ROLE : false

        if (!diveId) {
          const candidates = await context.transaction
            .select({
              id: dives.id,
              diveDate: dives.diveDate,
              entryTime: dives.entryTime,
              utcOffsetMinutes: dives.utcOffsetMinutes,
            })
            .from(dives)
            .where(inArray(dives.diveDate, adjacentDiveDates(mapped.diveDate)))
          const match = selectNearestDive(
            candidates.filter((candidate) => !reservedDiveIds.has(candidate.id)),
            mapped.startEpochSeconds,
            mapped.utcOffsetMinutes,
          )
          if (match) {
            diveId = match.diveId
            ownsDive = false
            matched += 1
          }
        }

        if (diveId) {
          // Re-imported records replace only their own derived rows.
          const importedSampleIds = record.canonicalLinks
            .filter((link) => link.canonicalEntityType === 'profile_sample')
            .map((link) => link.canonicalEntityId)
          const importedTankIds = record.canonicalLinks
            .filter((link) => link.canonicalEntityType === 'tank')
            .map((link) => link.canonicalEntityId)
          if (importedSampleIds.length > 0) {
            await context.transaction
              .delete(diveProfileSamples)
              .where(inArray(diveProfileSamples.id, importedSampleIds))
          }
          if (importedTankIds.length > 0) {
            await context.transaction
              .delete(tanks)
              .where(inArray(tanks.id, importedTankIds))
          }
          await context.unlinkCanonicalRecords(record.id, ['profile_sample', 'tank'])
        }

        if (diveId && ownsDive) {
          await context.transaction
            .update(dives)
            .set(garminDiveValues(mapped))
            .where(eq(dives.id, diveId))
          updated += 1
        } else if (diveId) {
          await enrichMatchedDive(context.transaction, diveId, mapped)
          if (diveLink) updated += 1
        } else {
          const [dive] = await context.transaction
            .insert(dives)
            .values(garminDiveValues(mapped))
            .returning({ id: dives.id })
          diveId = dive?.id ?? null
          ownsDive = true
          created += 1
        }
        if (!diveId) throw new Error(`Could not store Garmin dive ${mapped.externalId}`)
        reservedDiveIds.add(diveId)
        await context.linkCanonicalRecord(
          record.id,
          'dive',
          diveId,
          ownsDive ? 'produced' : MATCHED_LINK_ROLE,
        )

        // A matched log entry keeps its existing profile and cylinders; Garmin
        // data fills those in only when the dive has none of its own.
        const insertSamples =
          ownsDive || !(await diveHasProfileSamples(context.transaction, diveId))
        const insertTanks = ownsDive || !(await diveHasTanks(context.transaction, diveId))

        if (insertSamples) {
          for (const [sampleIndex, sample] of mapped.profileSamples.entries()) {
            context.signal.throwIfAborted()
            const [inserted] = await context.transaction
              .insert(diveProfileSamples)
              .values({
                diveId,
                sampleIndex,
                elapsedSeconds: sample.elapsedSeconds,
                depthMeters: String(sample.depthMeters),
                temperatureCelsius: numeric(sample.temperatureCelsius),
                decoCeilingMeters: numeric(sample.decoCeilingMeters),
              })
              .returning({ id: diveProfileSamples.id })
            if (inserted) {
              profileSamplesCreated += 1
              await context.linkCanonicalRecord(
                record.id,
                'profile_sample',
                inserted.id,
                'derived',
              )
            }
          }
        }
        if (insertTanks) {
          for (const gas of mapped.gases) {
            context.signal.throwIfAborted()
            const [inserted] = await context.transaction
              .insert(tanks)
              .values({
                diveId,
                name: `Garmin gas ${gas.index + 1}`,
                sortOrder: gas.index,
                oxygenPercent: numeric(gas.oxygenPercent),
                heliumPercent: numeric(gas.heliumPercent),
              })
              .returning({ id: tanks.id })
            if (inserted) {
              tanksCreated += 1
              await context.linkCanonicalRecord(record.id, 'tank', inserted.id, 'derived')
            }
          }
        }
      }

      return {
        created,
        updated,
        skipped,
        byEntity: {
          divesCreated: created,
          divesUpdated: updated,
          divesMatched: matched,
          profileSamplesCreated,
          tanksCreated,
        },
      }
    },
  }
}

export const garminConnector = createGarminConnector()
