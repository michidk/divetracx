import '@tanstack/react-start/server-only'

import { asc, count, desc, eq } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { getDb } from '@/db'
import {
  buddies,
  certifications,
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
import type { EditorValue, EditorValues, EntityKey } from '../entities'
import { entityDefinitions } from '../entities'
import type {
  DataEditorPayload,
  DataEditorRecord,
  DataListItem,
  DataListPage,
  DataOverviewItem,
  EditorOption,
} from '../types'

function timestamp(value: Date | null) {
  return value?.toISOString() ?? ''
}

function personName(person: { firstName: string | null; lastName: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Name not set'
}

function sourceListItem(
  row: { id: string; sourceKey: string; updatedAt: Date },
  title: string,
  subtitle: string | null = null,
  detail: string | null = null,
): DataListItem {
  return {
    id: row.id,
    title,
    subtitle,
    detail,
    sourceKey: row.sourceKey,
    updatedAt: timestamp(row.updatedAt),
  }
}

function editorValue(value: unknown): EditorValue {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(String)
  return JSON.stringify(value, null, 2)
}

function fieldValues(entity: EntityKey, row: object): EditorValues {
  const source = row as Record<string, unknown>
  return Object.fromEntries(
    entityDefinitions[entity].fields.map((field) => [
      field.key,
      editorValue(source[field.key]),
    ]),
  )
}

function editorRecord(
  entity: EntityKey,
  row: {
    id: string
    sourceKey: string
    externalId?: string | null
    updatedAt: Date
  },
): DataEditorRecord {
  return {
    id: row.id,
    values: fieldValues(entity, row),
    sourceKey: row.sourceKey,
    externalId: row.externalId ?? null,
    updatedAt: timestamp(row.updatedAt),
  }
}

async function tableCount(table: PgTable) {
  const [result] = await getDb().select({ value: count() }).from(table)
  return result?.value ?? 0
}

export async function loadDataOverview(): Promise<DataOverviewItem[]> {
  const values = await Promise.all([
    tableCount(dives),
    tableCount(diveSites),
    tableCount(divers),
    tableCount(buddies),
    tableCount(equipment),
    tableCount(certifications),
    tableCount(shops),
    tableCount(diveTypes),
    tableCount(tanks),
    tableCount(diveProfileSamples),
    tableCount(syncRuns),
  ])
  const entities: EntityKey[] = [
    'dives',
    'sites',
    'divers',
    'buddies',
    'equipment',
    'certifications',
    'shops',
    'dive-types',
    'tanks',
    'profile-samples',
    'sync-runs',
  ]
  return entities.map((entity, index) => ({ entity, count: values[index] ?? 0 }))
}

const PROFILE_SAMPLE_PAGE_SIZE = 250

async function loadDataListRecords(
  entity: EntityKey,
  page: number,
): Promise<DataListItem[]> {
  const db = getDb()
  switch (entity) {
    case 'dives': {
      const rows = await db
        .select({ dive: dives, siteName: diveSites.name })
        .from(dives)
        .leftJoin(diveSites, eq(dives.siteId, diveSites.id))
        .orderBy(desc(dives.diveDate), desc(dives.entryTime))
      return rows.map(({ dive, siteName }) =>
        sourceListItem(
          dive,
          `Dive #${dive.number ?? '—'}`,
          siteName ?? 'Unknown site',
          dive.diveDate,
        ),
      )
    }
    case 'sites': {
      const rows = await db.select().from(diveSites).orderBy(asc(diveSites.name))
      return rows.map((row) =>
        sourceListItem(
          row,
          row.name,
          [row.region, row.country].filter(Boolean).join(', ') || null,
          row.waterName,
        ),
      )
    }
    case 'divers': {
      const rows = await db
        .select()
        .from(divers)
        .orderBy(asc(divers.lastName), asc(divers.firstName))
      return rows.map((row) => sourceListItem(row, personName(row), row.email))
    }
    case 'buddies': {
      const rows = await db
        .select()
        .from(buddies)
        .orderBy(asc(buddies.lastName), asc(buddies.firstName))
      return rows.map((row) =>
        sourceListItem(
          row,
          personName(row),
          row.email,
          [row.city, row.country].filter(Boolean).join(', ') || null,
        ),
      )
    }
    case 'equipment': {
      const rows = await db
        .select()
        .from(equipment)
        .orderBy(asc(equipment.category), asc(equipment.name))
      return rows.map((row) =>
        sourceListItem(
          row,
          row.name,
          [row.manufacturer, row.model].filter(Boolean).join(' ') || null,
          row.category,
        ),
      )
    }
    case 'certifications': {
      const rows = await db
        .select({ certification: certifications, diver: divers })
        .from(certifications)
        .leftJoin(divers, eq(certifications.diverId, divers.id))
        .orderBy(desc(certifications.certifiedAt), asc(certifications.name))
      return rows.map(({ certification, diver }) =>
        sourceListItem(
          certification,
          certification.name,
          certification.organization,
          diver ? personName(diver) : null,
        ),
      )
    }
    case 'shops': {
      const rows = await db.select().from(shops).orderBy(asc(shops.name))
      return rows.map((row) => sourceListItem(row, row.name))
    }
    case 'dive-types': {
      const rows = await db
        .select()
        .from(diveTypes)
        .orderBy(asc(diveTypes.sortOrder), asc(diveTypes.name))
      return rows.map((row) =>
        sourceListItem(
          row,
          row.name,
          row.sortOrder === null ? null : `Sort order ${row.sortOrder}`,
        ),
      )
    }
    case 'tanks': {
      const rows = await db
        .select({ tank: tanks, diveNumber: dives.number, diveDate: dives.diveDate })
        .from(tanks)
        .innerJoin(dives, eq(tanks.diveId, dives.id))
        .orderBy(desc(dives.diveDate), asc(tanks.sortOrder))
      return rows.map(({ tank, diveNumber, diveDate }) =>
        sourceListItem(
          tank,
          tank.name || 'Tank',
          `Dive #${diveNumber ?? '—'} · ${diveDate}`,
          [
            tank.volumeLiters ? `${tank.volumeLiters} L` : null,
            tank.startPressureBar ? `${tank.startPressureBar} bar` : null,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        ),
      )
    }
    case 'profile-samples': {
      const rows = await db
        .select({
          sample: diveProfileSamples,
          diveNumber: dives.number,
          diveDate: dives.diveDate,
        })
        .from(diveProfileSamples)
        .innerJoin(dives, eq(diveProfileSamples.diveId, dives.id))
        .orderBy(
          desc(dives.diveDate),
          asc(diveProfileSamples.elapsedSeconds),
          asc(diveProfileSamples.sampleIndex),
        )
        .limit(PROFILE_SAMPLE_PAGE_SIZE)
        .offset((page - 1) * PROFILE_SAMPLE_PAGE_SIZE)
      return rows.map(({ sample, diveNumber, diveDate }) =>
        sourceListItem(
          sample,
          `${sample.depthMeters} m at ${sample.elapsedSeconds} s`,
          `Dive #${diveNumber ?? '—'} · ${diveDate}`,
          [
            `Sample ${sample.sampleIndex + 1}`,
            sample.temperatureCelsius ? `${sample.temperatureCelsius} °C` : null,
            sample.pressureBar ? `${sample.pressureBar} bar` : null,
            sample.decoCeilingMeters ? `${sample.decoCeilingMeters} m ceiling` : null,
            sample.tankNumber ? `Tank ${sample.tankNumber}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        ),
      )
    }
    case 'sync-runs': {
      const rows = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt))
      return rows.map((row) => ({
        id: row.id,
        title: `${row.status} synchronization`,
        subtitle: `${row.trigger} · ${row.sourceKey}`,
        detail: timestamp(row.startedAt),
        sourceKey: row.sourceKey,
        updatedAt: timestamp(row.finishedAt ?? row.startedAt),
      }))
    }
  }
}

export async function loadDataList(
  entity: EntityKey,
  requestedPage = 1,
): Promise<DataListPage> {
  const total = entity === 'profile-samples' ? await tableCount(diveProfileSamples) : null
  const pageSize =
    entity === 'profile-samples' ? PROFILE_SAMPLE_PAGE_SIZE : Math.max(total ?? 0, 1)
  const pageCount = Math.max(1, Math.ceil((total ?? 0) / pageSize))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  const records = await loadDataListRecords(entity, page)
  const resolvedTotal = total ?? records.length
  return {
    records,
    total: resolvedTotal,
    page,
    pageSize: entity === 'profile-samples' ? pageSize : Math.max(resolvedTotal, 1),
    pageCount: entity === 'profile-samples' ? pageCount : 1,
  }
}

async function referenceOptions(entity: EntityKey): Promise<EditorOption[]> {
  const { records } = await loadDataList(entity)
  return records.map((row) => ({
    value: row.id,
    label: [row.title, row.subtitle].filter(Boolean).join(' · '),
  }))
}

async function loadOptions(entity: EntityKey) {
  const references = new Map<string, EntityKey>()
  for (const field of entityDefinitions[entity].fields) {
    if (field.reference) references.set(field.key, field.reference)
  }

  const entries = await Promise.all(
    Array.from(
      references,
      async ([field, reference]) => [field, await referenceOptions(reference)] as const,
    ),
  )
  return Object.fromEntries(entries)
}

async function loadRecord(
  entity: EntityKey,
  id: string,
): Promise<DataEditorRecord | null> {
  const db = getDb()
  switch (entity) {
    case 'dives': {
      const [row] = await db.select().from(dives).where(eq(dives.id, id)).limit(1)
      if (!row) return null
      const [buddyRows, equipmentRows] = await Promise.all([
        db
          .select({ id: diveBuddies.buddyId })
          .from(diveBuddies)
          .where(eq(diveBuddies.diveId, id)),
        db
          .select({ id: diveEquipment.equipmentId })
          .from(diveEquipment)
          .where(eq(diveEquipment.diveId, id)),
      ])
      const record = editorRecord(entity, row)
      record.values.buddyIds = Array.from(new Set(buddyRows.map((item) => item.id)))
      record.values.equipmentIds = Array.from(
        new Set(equipmentRows.map((item) => item.id)),
      )
      return record
    }
    case 'sites': {
      const [row] = await db.select().from(diveSites).where(eq(diveSites.id, id)).limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'divers': {
      const [row] = await db.select().from(divers).where(eq(divers.id, id)).limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'buddies': {
      const [row] = await db.select().from(buddies).where(eq(buddies.id, id)).limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'equipment': {
      const [row] = await db.select().from(equipment).where(eq(equipment.id, id)).limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'certifications': {
      const [row] = await db
        .select()
        .from(certifications)
        .where(eq(certifications.id, id))
        .limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'shops': {
      const [row] = await db.select().from(shops).where(eq(shops.id, id)).limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'dive-types': {
      const [row] = await db.select().from(diveTypes).where(eq(diveTypes.id, id)).limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'tanks': {
      const [row] = await db.select().from(tanks).where(eq(tanks.id, id)).limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'profile-samples': {
      const [row] = await db
        .select()
        .from(diveProfileSamples)
        .where(eq(diveProfileSamples.id, id))
        .limit(1)
      return row ? editorRecord(entity, row) : null
    }
    case 'sync-runs': {
      const [row] = await db.select().from(syncRuns).where(eq(syncRuns.id, id)).limit(1)
      if (!row) return null
      return {
        id: row.id,
        sourceKey: row.sourceKey,
        externalId: null,
        updatedAt: timestamp(row.finishedAt ?? row.startedAt),
        values: {
          sourceKey: row.sourceKey,
          trigger: row.trigger,
          status: row.status,
          startedAt: timestamp(row.startedAt),
          finishedAt: timestamp(row.finishedAt),
          sourceFingerprint: row.sourceFingerprint ?? '',
          counts: row.counts ? JSON.stringify(row.counts, null, 2) : '',
          error: row.error ?? '',
        },
      }
    }
  }
}

export async function loadDataEditor(
  entity: EntityKey,
  recordId: string,
): Promise<DataEditorPayload> {
  const [record, options] = await Promise.all([
    recordId === 'new' ? null : loadRecord(entity, recordId),
    loadOptions(entity),
  ])
  return { record, options }
}

export async function dataRecordExists(entity: EntityKey, recordId: string) {
  if (recordId === 'new') return entityDefinitions[entity].mutable
  return Boolean(await loadRecord(entity, recordId))
}
