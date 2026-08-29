import type {
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

export interface ExportSnapshot {
  format: 'divetracx-backup'
  version: 2
  exportedAt: string
  data: {
    divers: Array<typeof divers.$inferSelect>
    diveSites: Array<typeof diveSites.$inferSelect>
    buddies: Array<typeof buddies.$inferSelect>
    equipment: Array<typeof equipment.$inferSelect>
    certifications: Array<typeof certifications.$inferSelect>
    shops: Array<typeof shops.$inferSelect>
    diveTypes: Array<typeof diveTypes.$inferSelect>
    dives: Array<typeof dives.$inferSelect>
    diveBuddies: Array<typeof diveBuddies.$inferSelect>
    diveEquipment: Array<typeof diveEquipment.$inferSelect>
    diveProfileSamples: Array<typeof diveProfileSamples.$inferSelect>
    tanks: Array<typeof tanks.$inferSelect>
    syncRuns: Array<typeof syncRuns.$inferSelect>
  }
}

export type ExportFormat = 'json' | 'csv' | 'uddf'

export interface ExportFile {
  body: string
  fileName: string
  contentType: string
}
