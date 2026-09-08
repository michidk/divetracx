import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import {
  certifications,
  diveProfileSamples,
  dives,
  equipment,
  externalRecordLinks,
  externalRecords,
  tanks,
} from '@/db/schema'
import {
  type ApplyImportContext,
  type ExternalRecordInput,
  type IntegrationConnector,
  MATCHED_LINK_ROLE,
} from '@/modules/integrations/types'
import { parseGarminActivityDetails } from '../activity-details'
import { GARMIN_ENTITIES } from '../entities'
import {
  isGarminCertification,
  mapGarminCertification,
  mapGarminEquipment,
  normalizedGearName,
} from '../gear-mapping'
import { mapGarminActivity } from '../mapping'
import { adjacentDiveDates, selectNearestDive } from '../matching'
import type {
  GarminMappedDive,
  GarminSourceActivity,
  GarminSourceBatch,
  GarminSourceClient,
  GarminSourceGear,
} from '../types'
import { createGarminSourceClient } from './client.server'

const SOURCE_KEY = 'garmin'

interface PreparedGarminActivity {
  source: GarminSourceActivity
  mapped: GarminMappedDive | null
}

interface PreparedGarminData {
  activities: Map<string, PreparedGarminActivity>
  gear: Map<string, GarminSourceGear>
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
  const gear = new Map<string, GarminSourceGear>()
  const records: ExternalRecordInput[] = []
  for (const item of batch.gear ?? []) {
    if (gear.has(item.gearId)) {
      throw new Error(`Garmin batch contains duplicate gear ${item.gearId}`)
    }
    gear.set(item.gearId, item)
    records.push({
      entityType: isGarminCertification(item) ? 'certification' : 'gear',
      identityKey: item.gearId,
      externalId: item.gearId,
      rawPayload: item.detail,
      externalUpdatedAt: validDate(
        typeof item.detail.lastModifiedTs === 'string'
          ? item.detail.lastModifiedTs
          : null,
      ),
      mapperVersion: 1,
    })
  }
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
  return { activities, gear, records, fingerprint }
}

/**
 * Gear and certifications from the Garmin Dive app. A record already linked
 * is updated in place; otherwise an existing row with the same name is
 * matched (and only enriched) so a DiveMate import of the same item is not
 * duplicated; anything else is created.
 */
async function applyGear(
  context: ApplyImportContext<PreparedGarminData>,
  counts: { created: number; updated: number; skipped: number; matched: number },
) {
  const byEntity: Record<string, number> = {}
  const equipmentRecords = context.records.filter(
    (record) => record.input.entityType === 'gear',
  )
  const certificationRecords = context.records.filter(
    (record) => record.input.entityType === 'certification',
  )
  if (equipmentRecords.length === 0 && certificationRecords.length === 0) return byEntity

  const existingEquipment = await context.transaction
    .select({ id: equipment.id, name: equipment.name })
    .from(equipment)
  const equipmentByName = new Map(
    existingEquipment.map((row) => [normalizedGearName(row.name), row.id]),
  )
  for (const record of equipmentRecords) {
    context.signal.throwIfAborted()
    const source = context.prepared.data.gear.get(record.input.identityKey)
    if (!source)
      throw new Error(`Prepared Garmin gear ${record.input.identityKey} is missing`)
    const link = record.canonicalLinks.find(
      (candidate) => candidate.canonicalEntityType === 'equipment',
    )
    if (record.change === 'unchanged' && link) {
      counts.skipped += 1
      continue
    }
    const mapped = mapGarminEquipment(source)
    if (!mapped) {
      counts.skipped += 1
      continue
    }
    const values = {
      name: mapped.name,
      category: mapped.category,
      manufacturer: mapped.manufacturer,
      model: mapped.model,
      serialNumber: mapped.serialNumber,
      purchasedAt: mapped.purchasedAt,
      purchasePrice: mapped.purchasePrice,
      purchaseShop: mapped.purchaseShop,
      retiredAt: mapped.retiredAt,
      serviceDueAt: mapped.serviceDueAt,
      inactive: mapped.inactive,
      weightKg: mapped.weightKg,
      notes: mapped.notes,
      updatedAt: new Date(),
    }
    if (link && link.role !== MATCHED_LINK_ROLE) {
      await context.transaction
        .update(equipment)
        .set(values)
        .where(eq(equipment.id, link.canonicalEntityId))
      counts.updated += 1
      byEntity.gearUpdated = (byEntity.gearUpdated ?? 0) + 1
      continue
    }
    const matchedId =
      link?.canonicalEntityId ?? equipmentByName.get(normalizedGearName(mapped.name))
    if (matchedId) {
      // A locally owned item keeps its values; Garmin only fills gaps.
      const [current] = await context.transaction
        .select({
          manufacturer: equipment.manufacturer,
          model: equipment.model,
          serialNumber: equipment.serialNumber,
          purchasedAt: equipment.purchasedAt,
          serviceDueAt: equipment.serviceDueAt,
        })
        .from(equipment)
        .where(eq(equipment.id, matchedId))
        .limit(1)
      await context.transaction
        .update(equipment)
        .set({
          updatedAt: new Date(),
          ...(current?.manufacturer === null
            ? { manufacturer: mapped.manufacturer }
            : {}),
          ...(current?.model === null ? { model: mapped.model } : {}),
          ...(current?.serialNumber === null
            ? { serialNumber: mapped.serialNumber }
            : {}),
          ...(current?.purchasedAt === null ? { purchasedAt: mapped.purchasedAt } : {}),
          ...(current?.serviceDueAt === null
            ? { serviceDueAt: mapped.serviceDueAt }
            : {}),
        })
        .where(eq(equipment.id, matchedId))
      if (!link) {
        await context.linkCanonicalRecord(
          record.id,
          'equipment',
          matchedId,
          MATCHED_LINK_ROLE,
        )
        counts.matched += 1
        byEntity.gearMatched = (byEntity.gearMatched ?? 0) + 1
      } else {
        counts.updated += 1
      }
      continue
    }
    const [inserted] = await context.transaction
      .insert(equipment)
      .values(values)
      .returning({ id: equipment.id })
    if (!inserted) throw new Error(`Could not store Garmin gear ${mapped.name}`)
    equipmentByName.set(normalizedGearName(mapped.name), inserted.id)
    await context.linkCanonicalRecord(record.id, 'equipment', inserted.id)
    counts.created += 1
    byEntity.gearCreated = (byEntity.gearCreated ?? 0) + 1
  }

  const existingCertifications = await context.transaction
    .select({ id: certifications.id, name: certifications.name })
    .from(certifications)
  const certificationByName = new Map(
    existingCertifications.map((row) => [normalizedGearName(row.name), row.id]),
  )
  for (const record of certificationRecords) {
    context.signal.throwIfAborted()
    const source = context.prepared.data.gear.get(record.input.identityKey)
    if (!source)
      throw new Error(
        `Prepared Garmin certification ${record.input.identityKey} is missing`,
      )
    const link = record.canonicalLinks.find(
      (candidate) => candidate.canonicalEntityType === 'certification',
    )
    if (record.change === 'unchanged' && link) {
      counts.skipped += 1
      continue
    }
    const mapped = mapGarminCertification(source)
    if (!mapped) {
      counts.skipped += 1
      continue
    }
    if (link && link.role !== MATCHED_LINK_ROLE) {
      await context.transaction
        .update(certifications)
        .set({
          name: mapped.name,
          certifiedAt: mapped.certifiedAt,
          updatedAt: new Date(),
        })
        .where(eq(certifications.id, link.canonicalEntityId))
      counts.updated += 1
      byEntity.certificationsUpdated = (byEntity.certificationsUpdated ?? 0) + 1
      continue
    }
    const matchedId =
      link?.canonicalEntityId ?? certificationByName.get(normalizedGearName(mapped.name))
    if (matchedId) {
      const [current] = await context.transaction
        .select({ certifiedAt: certifications.certifiedAt })
        .from(certifications)
        .where(eq(certifications.id, matchedId))
        .limit(1)
      if (current?.certifiedAt === null && mapped.certifiedAt) {
        await context.transaction
          .update(certifications)
          .set({ certifiedAt: mapped.certifiedAt, updatedAt: new Date() })
          .where(eq(certifications.id, matchedId))
      }
      if (!link) {
        await context.linkCanonicalRecord(
          record.id,
          'certification',
          matchedId,
          MATCHED_LINK_ROLE,
        )
        counts.matched += 1
        byEntity.certificationsMatched = (byEntity.certificationsMatched ?? 0) + 1
      } else {
        counts.updated += 1
      }
      continue
    }
    const [inserted] = await context.transaction
      .insert(certifications)
      .values({ name: mapped.name, certifiedAt: mapped.certifiedAt })
      .returning({ id: certifications.id })
    if (!inserted) throw new Error(`Could not store Garmin certification ${mapped.name}`)
    certificationByName.set(normalizedGearName(mapped.name), inserted.id)
    await context.linkCanonicalRecord(record.id, 'certification', inserted.id)
    counts.created += 1
    byEntity.certificationsCreated = (byEntity.certificationsCreated ?? 0) + 1
  }
  return byEntity
}

export function createGarminConnector(
  client: GarminSourceClient = createGarminSourceClient(),
): IntegrationConnector<PreparedGarminData> {
  return {
    descriptor: {
      key: SOURCE_KEY,
      displayName: 'Garmin',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      entities: GARMIN_ENTITIES,
    },
    async prepareImport(context) {
      const options = {
        signal: context.signal,
        includeGear:
          context.isEntityEnabled('equipment') ||
          context.isEntityEnabled('certifications'),
      }
      const batch =
        context.mode === 'full'
          ? await client.fetchFull(context.state, options)
          : await client.fetchIncremental(context.state, options)
      context.signal.throwIfAborted()
      const prepared = prepareBatch(batch)
      return {
        records: prepared.records,
        data: { activities: prepared.activities, gear: prepared.gear },
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
          gearReceived: prepared.gear.size,
        },
      }
    },
    async applyImport(context) {
      const gearCounts = { created: 0, updated: 0, skipped: 0, matched: 0 }
      const gearByEntity = await applyGear(context, gearCounts)
      let created = gearCounts.created
      let updated = gearCounts.updated
      let skipped = gearCounts.skipped
      let matched = gearCounts.matched
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
        if (record.input.entityType !== 'activity') continue
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

        // Switched-off derived rows stay as they are: replacing them with
        // nothing would delete data the owner asked the import not to touch.
        const syncSamples = context.isEntityEnabled('profile_samples')
        const syncTanks = context.isEntityEnabled('tanks')
        if (diveId) {
          // Re-imported records replace only their own derived rows.
          const importedSampleIds = record.canonicalLinks
            .filter((link) => link.canonicalEntityType === 'profile_sample')
            .map((link) => link.canonicalEntityId)
          const importedTankIds = record.canonicalLinks
            .filter((link) => link.canonicalEntityType === 'tank')
            .map((link) => link.canonicalEntityId)
          if (syncSamples && importedSampleIds.length > 0) {
            await context.transaction
              .delete(diveProfileSamples)
              .where(inArray(diveProfileSamples.id, importedSampleIds))
          }
          if (syncTanks && importedTankIds.length > 0) {
            await context.transaction
              .delete(tanks)
              .where(inArray(tanks.id, importedTankIds))
          }
          await context.unlinkCanonicalRecords(record.id, [
            ...(syncSamples ? ['profile_sample'] : []),
            ...(syncTanks ? ['tank'] : []),
          ])
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
          syncSamples &&
          (ownsDive || !(await diveHasProfileSamples(context.transaction, diveId)))
        const insertTanks =
          syncTanks && (ownsDive || !(await diveHasTanks(context.transaction, diveId)))

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
          divesCreated: created - gearCounts.created,
          divesUpdated: updated - gearCounts.updated,
          divesMatched: matched - gearCounts.matched,
          profileSamplesCreated,
          tanksCreated,
          ...gearByEntity,
        },
      }
    },
  }
}

export const garminConnector = createGarminConnector()
