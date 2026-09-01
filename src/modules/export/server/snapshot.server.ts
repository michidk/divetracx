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
      version: 7,
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
        pictures: await transaction.select().from(pictures),
        importRuns: await transaction.select().from(importRuns),
      },
    }),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
