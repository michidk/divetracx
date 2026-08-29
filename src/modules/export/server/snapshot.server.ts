import '@tanstack/react-start/server-only'

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
import type { ExportSnapshot } from '../types'

export async function loadExportSnapshot(): Promise<ExportSnapshot> {
  return getDb().transaction(
    async (transaction) => ({
      format: 'divetracx-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        divers: await transaction.select().from(divers),
        diveSites: await transaction.select().from(diveSites),
        buddies: await transaction.select().from(buddies),
        equipment: await transaction.select().from(equipment),
        certifications: await transaction.select().from(certifications),
        shops: await transaction.select().from(shops),
        diveTypes: await transaction.select().from(diveTypes),
        dives: await transaction.select().from(dives),
        diveBuddies: await transaction.select().from(diveBuddies),
        diveEquipment: await transaction.select().from(diveEquipment),
        diveProfileSamples: await transaction.select().from(diveProfileSamples),
        tanks: await transaction.select().from(tanks),
        syncRuns: await transaction.select().from(syncRuns),
      },
    }),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
