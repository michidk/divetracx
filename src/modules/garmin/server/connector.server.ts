import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { diveProfileSamples, diveSites, dives, tanks } from '@/db/schema'
import {
  performFullImport,
  performIncrementalImport,
} from '@/modules/integrations/server/import-service.server'
import type {
  ExternalRecordInput,
  IntegrationConnector,
  PerformImportOptions,
} from '@/modules/integrations/types'
import { parseGarminActivityDetails } from '../activity-details'
import { mapGarminActivity } from '../mapping'
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
      supportedEntities: ['dives', 'dive_sites', 'profile_samples', 'tanks', 'gases'],
    },
    async prepareImport(context) {
      const batch =
        context.mode === 'full'
          ? await client.fetchFull(context.state)
          : await client.fetchIncremental(context.state)
      const prepared = prepareBatch(batch)
      return {
        records: prepared.records,
        data: { activities: prepared.activities },
        nextState: batch.nextState,
        validation: {
          complete: true,
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
      let profileSamplesCreated = 0
      let tanksCreated = 0
      let sitesCreated = 0

      for (const record of context.records) {
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

        const existingDiveId = record.canonicalLinks.find(
          (link) => link.canonicalEntityType === 'dive',
        )?.canonicalEntityId
        const existingSiteId = record.canonicalLinks.find(
          (link) => link.canonicalEntityType === 'dive_site',
        )?.canonicalEntityId
        let siteId = existingSiteId ?? null
        if (mapped.latitude !== null && mapped.longitude !== null) {
          const siteValues = {
            name: mapped.activityName ?? `Garmin dive ${mapped.externalId}`,
            latitude: numeric(mapped.latitude),
            longitude: numeric(mapped.longitude),
            updatedAt: new Date(),
          }
          if (siteId) {
            await context.transaction
              .update(diveSites)
              .set(siteValues)
              .where(eq(diveSites.id, siteId))
          } else {
            const [site] = await context.transaction
              .insert(diveSites)
              .values(siteValues)
              .returning({ id: diveSites.id })
            siteId = site?.id ?? null
            if (siteId) sitesCreated += 1
          }
          if (siteId) {
            await context.linkCanonicalRecord(record.id, 'dive_site', siteId, 'location')
          }
        }

        const diveValues = {
          siteId,
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
        let diveId = existingDiveId ?? null
        if (diveId) {
          await context.transaction
            .update(dives)
            .set(diveValues)
            .where(eq(dives.id, diveId))
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
          updated += 1
        } else {
          const [dive] = await context.transaction
            .insert(dives)
            .values(diveValues)
            .returning({ id: dives.id })
          diveId = dive?.id ?? null
          created += 1
        }
        if (!diveId) throw new Error(`Could not store Garmin dive ${mapped.externalId}`)
        await context.linkCanonicalRecord(record.id, 'dive', diveId)

        for (const [sampleIndex, sample] of mapped.profileSamples.entries()) {
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
        for (const gas of mapped.gases) {
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

      return {
        created,
        updated,
        skipped,
        byEntity: {
          divesCreated: created,
          divesUpdated: updated,
          sitesCreated,
          profileSamplesCreated,
          tanksCreated,
        },
      }
    },
  }
}

export const garminConnector = createGarminConnector()

export function fullImportGarmin() {
  return performFullImport(garminConnector, { trigger: 'manual' })
}

export function incrementalImportGarmin(
  options: PerformImportOptions = { trigger: 'manual' },
) {
  return performIncrementalImport(garminConnector, options)
}
