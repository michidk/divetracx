import '@tanstack/react-start/server-only'

import { getDb } from '@/db'
import {
  agencies,
  agencyMemberships,
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
  equipmentSetItems,
  equipmentSets,
  importRuns,
  pictures,
  shops,
  tanks,
} from '@/db/schema'
import type { ExportSnapshot } from '../types'

export async function loadExportSnapshot(): Promise<ExportSnapshot> {
  return getDb().transaction(
    async (transaction) => ({
      format: 'divetracx-backup',
      version: 12,
      exportedAt: new Date().toISOString(),
      data: {
        agencies: await transaction.select().from(agencies),
        divers: await transaction.select().from(divers),
        diveSites: await transaction.select().from(diveSites),
        buddies: await transaction.select().from(buddies),
        equipment: await transaction.select().from(equipment),
        equipmentSets: await transaction.select().from(equipmentSets),
        equipmentSetItems: await transaction.select().from(equipmentSetItems),
        certifications: await transaction.select().from(certifications),
        agencyMemberships: await transaction.select().from(agencyMemberships),
        shops: await transaction.select().from(shops),
        diveTypes: await transaction.select().from(diveTypes),
        dives: await transaction.select().from(dives),
        diveBuddies: await transaction.select().from(diveBuddies),
        diveEquipment: await transaction.select().from(diveEquipment),
        diveProfileSamples: await transaction.select().from(diveProfileSamples),
        tanks: await transaction.select().from(tanks),
        pictures: await transaction.select().from(pictures),
        importRuns: await transaction.select().from(importRuns),
      },
    }),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
