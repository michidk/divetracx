import '@tanstack/react-start/server-only'

import { loadBuddyDetail } from '@/modules/buddies/server/queries.server'
import {
  type EditorValues,
  type EntityKey,
  entityDefinitions,
} from '@/modules/data/entities'
import { deleteDataRecord, saveDataRecord } from '@/modules/data/server/mutations.server'
import { loadDiveEditor } from '@/modules/dives/server/editor.server'
import type { DiveEntryInput } from '@/modules/dives/server/mutations'
import { deleteDiveEntry, saveDiveEntry } from '@/modules/dives/server/mutations.server'
import { deleteGearSet, saveGearSet } from '@/modules/gear/server/mutations.server'
import { loadGearDetail, loadGearSetEditor } from '@/modules/gear/server/queries.server'
import type {
  BuddyValues,
  CreateDiveToolInput,
  GearSetValues,
  GearValues,
  ProfileValues,
  SiteValues,
  UpdateDiveToolInput,
} from '@/modules/mcp/tool-inputs'
import { loadProfile } from '@/modules/profile/server/queries.server'
import { loadSiteDetail } from '@/modules/sites/server/queries.server'

type McpValues = Record<string, string | number | boolean | null | undefined>

function editorValue(value: unknown): string | boolean {
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function mergedEditorValues(
  entity: EntityKey,
  current: Record<string, unknown> | null,
  changes: McpValues,
) {
  return Object.fromEntries(
    entityDefinitions[entity].fields.map((field) => [
      field.key,
      editorValue(
        changes[field.key] === undefined ? current?.[field.key] : changes[field.key],
      ),
    ]),
  ) satisfies EditorValues
}

function diveText(value: unknown) {
  return value === null || value === undefined ? '' : String(value)
}

function secondsAsMinutes(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value / 60)
}

function existingDiveInput(
  editor: NonNullable<Awaited<ReturnType<typeof loadDiveEditor>>>,
): DiveEntryInput {
  const dive = editor.dive
  if (!dive) throw new Error('The dive was not found')
  return {
    diveId: dive.id,
    dive: {
      number: diveText(dive.number),
      diveDate: dive.diveDate,
      entryTime: diveText(dive.entryTime),
      durationMinutes: secondsAsMinutes(dive.durationSeconds),
      surfaceIntervalMinutes: secondsAsMinutes(dive.surfaceIntervalSeconds),
      maximumDepthMeters: diveText(dive.maximumDepthMeters),
      averageDepthMeters: diveText(dive.averageDepthMeters),
      airTemperatureCelsius: diveText(dive.airTemperatureCelsius),
      waterTemperatureCelsius: diveText(dive.waterTemperatureCelsius),
      weightKg: diveText(dive.weightKg),
      equipmentWeightKg: diveText(dive.equipmentWeightKg),
      decompressionDive: dive.decompressionDive,
      safetyStop: dive.safetyStop,
      safetyStopMinutes: secondsAsMinutes(dive.safetyStopSeconds),
      pressureGroupBeforeInterval: diveText(dive.pressureGroupBeforeInterval),
      pressureGroupAfterInterval: diveText(dive.pressureGroupAfterInterval),
      pressureGroupEnd: diveText(dive.pressureGroupEnd),
      residualNitrogenMinutes: secondsAsMinutes(dive.residualNitrogenSeconds),
      waterType: diveText(dive.waterType),
      entryType: diveText(dive.entryType),
      visibility: diveText(dive.visibility),
      current: diveText(dive.current),
      waves: diveText(dive.waves),
      weather: diveText(dive.weather),
      rating: dive.rating ?? 0,
      computer: diveText(dive.computer),
      suit: diveText(dive.suit),
      boatId: diveText(dive.boatId),
      notes: diveText(dive.notes),
      siteId: diveText(dive.siteId),
      shopId: diveText(dive.shopId),
      diveTypeId: diveText(dive.diveTypeId),
    },
    buddyAssignments: editor.buddyAssignments,
    equipmentIds: editor.equipmentIds,
    tanks: editor.tanks.map((tank) => ({
      id: tank.id,
      name: diveText(tank.name),
      volumeLiters: diveText(tank.volumeLiters),
      oxygenPercent: diveText(tank.oxygenPercent),
      heliumPercent: diveText(tank.heliumPercent),
      startPressureBar: diveText(tank.startPressureBar),
      endPressureBar: diveText(tank.endPressureBar),
    })),
  }
}

function applyDiveChanges(
  base: DiveEntryInput,
  changes: CreateDiveToolInput | UpdateDiveToolInput,
) {
  const next = structuredClone(base)
  const fields = changes as Record<string, unknown>
  const textFields = [
    'number',
    'diveDate',
    'entryTime',
    'maximumDepthMeters',
    'averageDepthMeters',
    'airTemperatureCelsius',
    'waterTemperatureCelsius',
    'weightKg',
    'equipmentWeightKg',
    'waterType',
    'entryType',
    'visibility',
    'current',
    'waves',
    'weather',
    'pressureGroupBeforeInterval',
    'pressureGroupAfterInterval',
    'pressureGroupEnd',
    'computer',
    'suit',
    'notes',
    'siteId',
    'shopId',
    'boatId',
    'diveTypeId',
  ] as const
  for (const field of textFields) {
    if (fields[field] !== undefined) next.dive[field] = diveText(fields[field])
  }
  if (changes.durationSeconds !== undefined) {
    next.dive.durationMinutes = secondsAsMinutes(changes.durationSeconds)
  }
  if (changes.surfaceIntervalSeconds !== undefined) {
    next.dive.surfaceIntervalMinutes = secondsAsMinutes(changes.surfaceIntervalSeconds)
  }
  if (changes.decompressionDive !== undefined) {
    next.dive.decompressionDive = changes.decompressionDive
  }
  if (changes.safetyStop !== undefined) next.dive.safetyStop = changes.safetyStop
  if (changes.safetyStopSeconds !== undefined) {
    next.dive.safetyStopMinutes = secondsAsMinutes(changes.safetyStopSeconds)
  }
  if (changes.residualNitrogenSeconds !== undefined) {
    next.dive.residualNitrogenMinutes = secondsAsMinutes(changes.residualNitrogenSeconds)
  }
  if (changes.rating !== undefined) next.dive.rating = changes.rating ?? 0
  if (changes.buddyAssignments !== undefined) {
    next.buddyAssignments = changes.buddyAssignments
  }
  if (changes.equipmentIds !== undefined) next.equipmentIds = changes.equipmentIds
  if (changes.tanks !== undefined) {
    next.tanks = changes.tanks.map((tank) => ({
      id: tank.id ?? null,
      name: diveText(tank.name),
      volumeLiters: diveText(tank.volumeLiters),
      oxygenPercent: diveText(tank.oxygenPercent),
      heliumPercent: diveText(tank.heliumPercent),
      startPressureBar: diveText(tank.startPressureBar),
      endPressureBar: diveText(tank.endPressureBar),
    }))
  }
  return next
}

export async function createDiveFromMcp(input: CreateDiveToolInput) {
  const editor = await loadDiveEditor(null)
  if (!editor) throw new Error('Dive reference data is unavailable')
  const base: DiveEntryInput = {
    diveId: 'new',
    dive: {
      number: String(editor.nextNumber),
      diveDate: input.diveDate,
      entryTime: '',
      durationMinutes: '0',
      surfaceIntervalMinutes: '',
      maximumDepthMeters: '',
      averageDepthMeters: '',
      airTemperatureCelsius: '',
      waterTemperatureCelsius: '',
      weightKg: '',
      equipmentWeightKg: '',
      decompressionDive: false,
      safetyStop: false,
      safetyStopMinutes: '',
      pressureGroupBeforeInterval: '',
      pressureGroupAfterInterval: '',
      pressureGroupEnd: '',
      residualNitrogenMinutes: '',
      waterType: '',
      entryType: '',
      visibility: '',
      current: '',
      waves: '',
      weather: '',
      rating: 0,
      computer: '',
      suit: '',
      boatId: '',
      notes: '',
      siteId: '',
      shopId: '',
      diveTypeId: '',
    },
    buddyAssignments: [],
    equipmentIds: [],
    tanks: [],
  }
  return saveDiveEntry(applyDiveChanges(base, input))
}

export async function updateDiveFromMcp(input: UpdateDiveToolInput) {
  const editor = await loadDiveEditor(input.diveId)
  if (!editor?.dive) throw new Error('The dive was not found')
  return saveDiveEntry(applyDiveChanges(existingDiveInput(editor), input))
}

async function saveEntityFromMcp(
  entity: Extract<EntityKey, 'sites' | 'buddies' | 'equipment' | 'divers'>,
  id: string,
  current: Record<string, unknown> | null,
  changes: McpValues,
) {
  return saveDataRecord(entity, id, mergedEditorValues(entity, current, changes))
}

export async function createSiteFromMcp(input: SiteValues) {
  return saveEntityFromMcp('sites', 'new', null, input)
}

export async function updateSiteFromMcp(id: string, input: SiteValues) {
  const detail = await loadSiteDetail(id)
  if (!detail) throw new Error('Dive site was not found')
  return saveEntityFromMcp('sites', id, detail.site, input)
}

export async function createBuddyFromMcp(input: BuddyValues) {
  return saveEntityFromMcp('buddies', 'new', null, input)
}

export async function updateBuddyFromMcp(id: string, input: BuddyValues) {
  const detail = await loadBuddyDetail(id)
  if (!detail) throw new Error('Buddy was not found')
  return saveEntityFromMcp('buddies', id, detail.buddy, input)
}

export async function createGearFromMcp(input: GearValues) {
  return saveEntityFromMcp('equipment', 'new', null, input)
}

export async function updateGearFromMcp(id: string, input: GearValues) {
  const detail = await loadGearDetail(id)
  if (!detail) throw new Error('Gear item was not found')
  return saveEntityFromMcp('equipment', id, detail.item, input)
}

export async function updateProfileFromMcp(input: ProfileValues) {
  const profile = await loadProfile()
  return saveEntityFromMcp('divers', profile.diver?.id ?? 'new', profile.diver, input)
}

export async function createGearSetFromMcp(input: GearSetValues) {
  if (!input.name) throw new Error('Name is required')
  return saveGearSet({
    id: 'new',
    name: input.name,
    notes: input.notes ?? '',
    inactive: input.inactive ?? false,
    equipmentIds: input.equipmentIds ?? [],
  })
}

export async function updateGearSetFromMcp(id: string, input: GearSetValues) {
  const editor = await loadGearSetEditor(id)
  if (!editor?.set) throw new Error('Gear set was not found')
  return saveGearSet({
    id,
    name: input.name ?? editor.set.name,
    notes: input.notes === undefined ? (editor.set.notes ?? '') : (input.notes ?? ''),
    inactive: input.inactive ?? editor.set.inactive,
    equipmentIds: input.equipmentIds ?? editor.equipmentIds,
  })
}

export async function deleteDiveFromMcp(id: string) {
  await deleteDiveEntry(id)
}

export async function deleteEntityFromMcp(
  entity: 'sites' | 'buddies' | 'equipment',
  id: string,
) {
  await deleteDataRecord(entity, id)
}

export async function deleteGearSetFromMcp(id: string) {
  await deleteGearSet(id)
}
