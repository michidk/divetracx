import '@tanstack/react-start/server-only'

import { createHash } from 'node:crypto'
import { asc, eq, inArray } from 'drizzle-orm'
import type { DatabaseTransaction } from '@/db'
import {
  buddies,
  diveBuddies,
  diveProfileSamples,
  diveSites,
  dives,
  diveTypes,
  tanks,
} from '@/db/schema'
import {
  cleanDiveMateInstructorName,
  formatDiveMateInstructor,
  normalizeDiveMateInstructorName,
} from '@/modules/divemate/instructor'
import { buildExportFile } from '@/modules/export/server/files.server'
import type {
  ApplyImportContext,
  ExternalRecordInput,
  IntegrationConnector,
} from '@/modules/integrations/types'
import { MATCHED_LINK_ROLE } from '@/modules/integrations/types'
import { matchDiveTypeFromTags } from '../mapping'
import { parseSubsurfaceLogbook } from '../parser'
import type { SubsurfaceDive, SubsurfaceLogbook, SubsurfaceSite } from '../types'

export const SUBSURFACE_INTEGRATION_KEY = 'subsurface'
const MAPPER_VERSION = 1

export interface SubsurfaceUpload {
  fileName: string
  xml: string
}

interface PreparedSubsurfaceData {
  logbook: SubsurfaceLogbook
  sitesById: Map<string, SubsurfaceSite>
  divesById: Map<string, SubsurfaceDive>
}

function numeric(value: number | null, decimals: number) {
  return value === null ? null : value.toFixed(decimals)
}

function siteRecord(site: SubsurfaceSite): ExternalRecordInput {
  return {
    entityType: 'dive_site',
    identityKey: site.externalId,
    externalId: site.externalId,
    rawPayload: { ...site },
    mapperVersion: MAPPER_VERSION,
  }
}

function diveRecord(dive: SubsurfaceDive): ExternalRecordInput {
  return {
    entityType: 'dive',
    identityKey: dive.externalId,
    externalId: dive.externalId,
    rawPayload: { ...dive },
    mapperVersion: MAPPER_VERSION,
  }
}

async function loadSiteIndex(transaction: DatabaseTransaction) {
  const rows = await transaction
    .select({
      id: diveSites.id,
      name: diveSites.name,
      latitude: diveSites.latitude,
      longitude: diveSites.longitude,
    })
    .from(diveSites)
    .orderBy(asc(diveSites.createdAt), asc(diveSites.id))
  const byName = new Map<string, string>()
  const byCoordinates = new Map<string, string>()
  for (const row of rows) {
    const name = row.name.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('en-US')
    if (name && !byName.has(name)) byName.set(name, row.id)
    if (row.latitude !== null && row.longitude !== null) {
      const key = coordinateKey(Number(row.latitude), Number(row.longitude))
      if (!byCoordinates.has(key)) byCoordinates.set(key, row.id)
    }
  }
  return { byName, byCoordinates }
}

/** Sites within roughly ten metres of each other count as the same place. */
function coordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`
}

async function loadBuddyIndex(transaction: DatabaseTransaction) {
  const rows = await transaction
    .select({ id: buddies.id, firstName: buddies.firstName, lastName: buddies.lastName })
    .from(buddies)
    .orderBy(asc(buddies.createdAt), asc(buddies.id))
  const index = new Map<string, string>()
  for (const buddy of rows) {
    const normalized = normalizeDiveMateInstructorName(formatDiveMateInstructor(buddy))
    if (normalized && !index.has(normalized)) index.set(normalized, buddy.id)
  }
  return index
}

async function resolveBuddy(
  transaction: DatabaseTransaction,
  index: Map<string, string>,
  importedName: string,
) {
  const name = cleanDiveMateInstructorName(importedName)
  const normalized = normalizeDiveMateInstructorName(name)
  if (!name || !normalized) return null
  const existing = index.get(normalized)
  if (existing) return existing
  const [buddy] = await transaction
    .insert(buddies)
    .values({ firstName: name })
    .returning({ id: buddies.id })
  if (!buddy) throw new Error('Subsurface person could not be stored as a buddy')
  index.set(normalized, buddy.id)
  return buddy.id
}

async function applySites(
  context: ApplyImportContext<PreparedSubsurfaceData>,
  counts: { created: number; updated: number; skipped: number; matched: number },
) {
  const siteIds = new Map<string, string>()
  const index = await loadSiteIndex(context.transaction)
  for (const record of context.records) {
    if (record.input.entityType !== 'dive_site') continue
    context.signal.throwIfAborted()
    const site = context.prepared.data.sitesById.get(record.input.identityKey)
    if (!site)
      throw new Error(`Prepared Subsurface site ${record.input.identityKey} is missing`)
    const link = record.canonicalLinks.find(
      (candidate) => candidate.canonicalEntityType === 'dive_site',
    )
    if (record.change === 'unchanged' && link) {
      siteIds.set(site.externalId, link.canonicalEntityId)
      counts.skipped += 1
      continue
    }
    const values = {
      name: site.name,
      country: site.country,
      region: site.region,
      waterName: site.waterName,
      latitude: numeric(site.latitude, 7),
      longitude: numeric(site.longitude, 7),
      notes: site.notes,
      updatedAt: new Date(),
    }
    if (link && link.role !== MATCHED_LINK_ROLE) {
      await context.transaction
        .update(diveSites)
        .set(values)
        .where(eq(diveSites.id, link.canonicalEntityId))
      siteIds.set(site.externalId, link.canonicalEntityId)
      counts.updated += 1
      continue
    }
    // A site that already exists locally is only referenced, never rewritten.
    const matchedId =
      link?.canonicalEntityId ??
      index.byName.get(
        site.name.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('en-US'),
      ) ??
      (site.latitude !== null && site.longitude !== null
        ? index.byCoordinates.get(coordinateKey(site.latitude, site.longitude))
        : undefined)
    if (matchedId) {
      siteIds.set(site.externalId, matchedId)
      await context.linkCanonicalRecord(
        record.id,
        'dive_site',
        matchedId,
        MATCHED_LINK_ROLE,
      )
      counts.matched += 1
      continue
    }
    const [inserted] = await context.transaction
      .insert(diveSites)
      .values(values)
      .returning({ id: diveSites.id })
    if (!inserted) throw new Error(`Could not store Subsurface site ${site.name}`)
    siteIds.set(site.externalId, inserted.id)
    await context.linkCanonicalRecord(record.id, 'dive_site', inserted.id)
    counts.created += 1
  }
  return siteIds
}

function diveValues(
  dive: SubsurfaceDive,
  siteId: string | null,
  diveTypeId: string | null,
) {
  return {
    captureSource: dive.computer ? ('computer' as const) : ('manual' as const),
    siteId,
    diveTypeId,
    number: dive.number,
    diveDate: dive.diveDate,
    entryTime: dive.entryTime,
    durationSeconds: dive.durationSeconds,
    maximumDepthMeters: numeric(dive.maximumDepthMeters, 2),
    averageDepthMeters: numeric(dive.averageDepthMeters, 2),
    airTemperatureCelsius: numeric(dive.airTemperatureCelsius, 2),
    waterTemperatureCelsius: numeric(dive.waterTemperatureCelsius, 2),
    weightKg: numeric(dive.weightKg, 3),
    decompressionDive: dive.decompressionDive,
    visibility: dive.visibility === null ? null : `${dive.visibility}/5`,
    waterType: dive.waterType,
    entryType: dive.entryType,
    rating: dive.rating,
    computer: dive.computer,
    suit: dive.suit,
    notes: dive.notes,
    updatedAt: new Date(),
  }
}

async function replaceDerivedRows(
  context: ApplyImportContext<PreparedSubsurfaceData>,
  recordId: string,
  links: Array<{ canonicalEntityType: string; canonicalEntityId: string }>,
) {
  const ids = (entityType: string) =>
    links
      .filter((link) => link.canonicalEntityType === entityType)
      .map((link) => link.canonicalEntityId)
  const sampleIds = ids('profile_sample')
  if (sampleIds.length > 0) {
    await context.transaction
      .delete(diveProfileSamples)
      .where(inArray(diveProfileSamples.id, sampleIds))
  }
  const tankIds = ids('tank')
  if (tankIds.length > 0) {
    await context.transaction.delete(tanks).where(inArray(tanks.id, tankIds))
  }
  const buddyLinkIds = ids('dive_buddy')
  if (buddyLinkIds.length > 0) {
    await context.transaction
      .delete(diveBuddies)
      .where(inArray(diveBuddies.id, buddyLinkIds))
  }
  await context.unlinkCanonicalRecords(recordId, ['profile_sample', 'tank', 'dive_buddy'])
}

async function applyDives(
  context: ApplyImportContext<PreparedSubsurfaceData>,
  siteIds: Map<string, string>,
  counts: { created: number; updated: number; skipped: number },
  byEntity: Record<string, number>,
) {
  const buddyIndex = await loadBuddyIndex(context.transaction)
  const knownDiveTypes = await context.transaction
    .select({ id: diveTypes.id, name: diveTypes.name })
    .from(diveTypes)
  for (const record of context.records) {
    if (record.input.entityType !== 'dive') continue
    context.signal.throwIfAborted()
    if (record.change === 'unchanged') {
      counts.skipped += 1
      continue
    }
    const dive = context.prepared.data.divesById.get(record.input.identityKey)
    if (!dive)
      throw new Error(`Prepared Subsurface dive ${record.input.identityKey} is missing`)

    const link = record.canonicalLinks.find(
      (candidate) => candidate.canonicalEntityType === 'dive',
    )
    // A matched dive belongs to the logbook rather than to this file — it was
    // merged into another dive, or already existed here. Rewriting it, or
    // replacing rows it now owns, would discard local work.
    if (link && link.role === MATCHED_LINK_ROLE) {
      counts.skipped += 1
      continue
    }
    const siteId = dive.siteExternalId ? (siteIds.get(dive.siteExternalId) ?? null) : null
    const diveTypeId = matchDiveTypeFromTags(dive.tags, knownDiveTypes)?.id ?? null
    const values = diveValues(dive, siteId, diveTypeId)

    let diveId: string
    if (link) {
      await context.transaction
        .update(dives)
        .set(values)
        .where(eq(dives.id, link.canonicalEntityId))
      diveId = link.canonicalEntityId
      await replaceDerivedRows(context, record.id, record.canonicalLinks)
      counts.updated += 1
    } else {
      const [inserted] = await context.transaction
        .insert(dives)
        .values(values)
        .returning({ id: dives.id })
      if (!inserted) throw new Error(`Could not store Subsurface dive ${dive.externalId}`)
      diveId = inserted.id
      await context.linkCanonicalRecord(record.id, 'dive', diveId)
      counts.created += 1
    }

    for (const person of dive.people) {
      context.signal.throwIfAborted()
      const buddyId = await resolveBuddy(context.transaction, buddyIndex, person.name)
      if (!buddyId) continue
      const [association] = await context.transaction
        .insert(diveBuddies)
        .values({ diveId, buddyId, role: person.role })
        .onConflictDoUpdate({
          target: [diveBuddies.diveId, diveBuddies.buddyId],
          set: { role: person.role },
        })
        .returning({ id: diveBuddies.id })
      if (association) {
        await context.linkCanonicalRecord(
          record.id,
          'dive_buddy',
          association.id,
          'derived',
        )
        byEntity.diveBuddies = (byEntity.diveBuddies ?? 0) + 1
      }
    }

    for (const cylinder of dive.cylinders) {
      context.signal.throwIfAborted()
      const [inserted] = await context.transaction
        .insert(tanks)
        .values({
          diveId,
          name: cylinder.description ?? `Cylinder ${cylinder.sortOrder + 1}`,
          sortOrder: cylinder.sortOrder,
          computerTankNumber: cylinder.sortOrder + 1,
          volumeLiters: numeric(cylinder.volumeLiters, 2),
          startPressureBar: numeric(cylinder.startPressureBar, 2),
          endPressureBar: numeric(cylinder.endPressureBar, 2),
          workingPressureBar: numeric(cylinder.workingPressureBar, 2),
          oxygenPercent: numeric(cylinder.oxygenPercent, 2),
          heliumPercent: numeric(cylinder.heliumPercent, 2),
        })
        .returning({ id: tanks.id })
      if (inserted) {
        await context.linkCanonicalRecord(record.id, 'tank', inserted.id, 'derived')
        byEntity.tanks = (byEntity.tanks ?? 0) + 1
      }
    }

    if (dive.samples.length > 0) {
      const inserted = await context.transaction
        .insert(diveProfileSamples)
        .values(
          dive.samples.map((sample, sampleIndex) => ({
            diveId,
            sampleIndex,
            elapsedSeconds: sample.elapsedSeconds,
            depthMeters: sample.depthMeters.toFixed(2),
            temperatureCelsius: numeric(sample.temperatureCelsius, 2),
            pressureBar: numeric(sample.pressureBar, 2),
            tank1PressureBar: numeric(sample.tank1PressureBar, 2),
            tank2PressureBar: numeric(sample.tank2PressureBar, 2),
            decoCeilingMeters: numeric(sample.decoCeilingMeters, 2),
            tankNumber: sample.tankNumber,
          })),
        )
        .returning({ id: diveProfileSamples.id })
      for (const sample of inserted) {
        await context.linkCanonicalRecord(
          record.id,
          'profile_sample',
          sample.id,
          'derived',
        )
      }
      byEntity.profileSamples = (byEntity.profileSamples ?? 0) + inserted.length
    }
  }
}

/**
 * Subsurface imports are file uploads, so every upload gets its own connector
 * instance carrying the file. The registry holds an upload-less instance for
 * status listing and export; importing through it reports a helpful error.
 */
export function createSubsurfaceConnector(
  upload: SubsurfaceUpload | null = null,
): IntegrationConnector<PreparedSubsurfaceData> {
  return {
    descriptor: {
      key: SUBSURFACE_INTEGRATION_KEY,
      displayName: 'Subsurface',
      capabilities: { fullImport: false, incrementalImport: true, export: true },
      supportedEntities: ['dives', 'dive_sites', 'buddies', 'tanks', 'profile_samples'],
    },
    async prepareImport(context) {
      if (!upload) {
        throw new Error('Choose a Subsurface logbook file (.ssrf or .xml) to import')
      }
      context.signal.throwIfAborted()
      const logbook = parseSubsurfaceLogbook(upload.xml)
      const fingerprint = createHash('sha256').update(upload.xml).digest('hex')
      const previousFiles = Array.isArray(context.state.files)
        ? (context.state.files as unknown[]).filter(
            (item): item is string => typeof item === 'string',
          )
        : []
      return {
        records: [...logbook.sites.map(siteRecord), ...logbook.dives.map(diveRecord)],
        data: {
          logbook,
          sitesById: new Map(logbook.sites.map((site) => [site.externalId, site])),
          divesById: new Map(logbook.dives.map((dive) => [dive.externalId, dive])),
        },
        nextState: {
          files: [
            ...previousFiles.slice(-19),
            `${upload.fileName}:${fingerprint.slice(0, 12)}`,
          ],
          lastFileName: upload.fileName,
        },
        validation: {
          complete: true,
          sourceDescription: `Subsurface logbook ${upload.fileName} (format ${logbook.formatVersion})`,
        },
        sourceFingerprint: fingerprint,
        diagnostics: {
          fileName: upload.fileName,
          byteSize: Buffer.byteLength(upload.xml),
          formatVersion: logbook.formatVersion,
          sitesInFile: logbook.sites.length,
          divesInFile: logbook.dives.length,
          divesSkipped: logbook.diagnostics.divesSkipped,
          tripsSeen: logbook.diagnostics.tripsSeen,
        },
      }
    },
    async applyImport(context) {
      const siteCounts = { created: 0, updated: 0, skipped: 0, matched: 0 }
      const byEntity: Record<string, number> = {}
      const siteIds = await applySites(context, siteCounts)
      const diveCounts = { created: 0, updated: 0, skipped: 0 }
      await applyDives(context, siteIds, diveCounts, byEntity)
      byEntity.sitesCreated = siteCounts.created
      byEntity.sitesMatched = siteCounts.matched
      byEntity.divesCreated = diveCounts.created
      byEntity.divesUpdated = diveCounts.updated
      return {
        created: siteCounts.created + diveCounts.created,
        updated: siteCounts.updated + diveCounts.updated,
        skipped: siteCounts.skipped + diveCounts.skipped,
        byEntity,
      }
    },
    async export() {
      return buildExportFile('subsurface')
    },
  }
}

export const subsurfaceConnector = createSubsurfaceConnector()
