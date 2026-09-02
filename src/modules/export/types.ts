import type {
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

export interface ExportSnapshot {
  format: 'divetracx-backup'
  version: 12
  exportedAt: string
  data: {
    agencies: Array<typeof agencies.$inferSelect>
    divers: Array<typeof divers.$inferSelect>
    diveSites: Array<typeof diveSites.$inferSelect>
    buddies: Array<typeof buddies.$inferSelect>
    equipment: Array<typeof equipment.$inferSelect>
    equipmentSets: Array<typeof equipmentSets.$inferSelect>
    equipmentSetItems: Array<typeof equipmentSetItems.$inferSelect>
    certifications: Array<typeof certifications.$inferSelect>
    agencyMemberships: Array<typeof agencyMemberships.$inferSelect>
    shops: Array<typeof shops.$inferSelect>
    diveTypes: Array<typeof diveTypes.$inferSelect>
    dives: Array<typeof dives.$inferSelect>
    diveBuddies: Array<typeof diveBuddies.$inferSelect>
    diveEquipment: Array<typeof diveEquipment.$inferSelect>
    diveProfileSamples: Array<typeof diveProfileSamples.$inferSelect>
    tanks: Array<typeof tanks.$inferSelect>
    pictures: Array<typeof pictures.$inferSelect>
    importRuns: Array<typeof importRuns.$inferSelect>
  }
}

export type ExportFormat = 'json' | 'csv' | 'uddf'

export interface ExportFile {
  body: string
  fileName: string
  contentType: string
}
