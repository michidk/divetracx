import { describe, expect, test } from 'bun:test'
import { getTableColumns } from 'drizzle-orm'
import {
  agencyMemberships,
  buddies,
  buddyAgencyMemberships,
  buddyCertifications,
  certifications,
  divers,
  diveSites,
  equipment,
} from '@/db/schema'
import { entityDefinitionList, entityDefinitions, entityKeySchema } from './entities'

const entityTables = {
  sites: diveSites,
  divers,
  buddies,
  equipment,
  certifications,
  agencyMemberships,
  buddyCertifications,
  buddyAgencyMemberships,
} as const

const recordMetadataColumns = new Set(['id', 'createdAt', 'updatedAt'])

// Columns that exist in the schema but are intentionally not user-editable:
// they are either assigned automatically, preserved for import round-trips,
// or managed through the dive editor instead of the taxonomy form.
const managedElsewhereColumns: Record<keyof typeof entityTables, Set<string>> = {
  sites: new Set(),
  divers: new Set(),
  buddies: new Set(),
  equipment: new Set(['diverId']),
  certifications: new Set([
    'diverId',
    'organization',
    'sortOrder',
    'scan1Path',
    'scan2Path',
    'scan1StoragePath',
    'scan1ThumbnailStoragePath',
    'scan1MimeType',
    'scan1ByteSize',
    'scan2StoragePath',
    'scan2ThumbnailStoragePath',
    'scan2MimeType',
    'scan2ByteSize',
  ]),
  agencyMemberships: new Set(['diverId']),
  buddyCertifications: new Set(['buddyId']),
  buddyAgencyMemberships: new Set(['buddyId']),
}

describe('taxonomy entity definitions', () => {
  test('defines every entity exactly once', () => {
    expect(entityDefinitionList).toHaveLength(entityKeySchema.options.length)
    expect(new Set(entityDefinitionList.map((item) => item.key)).size).toBe(
      entityKeySchema.options.length,
    )
  })

  test('uses unique field keys and non-empty sections', () => {
    for (const definition of entityDefinitionList) {
      const fieldKeys = definition.fields.map((field) => field.key)
      expect(new Set(fieldKeys).size).toBe(fieldKeys.length)
      for (const field of definition.fields) {
        expect(field.section.length).toBeGreaterThan(0)
      }
    }
  })

  test('covers every user-editable domain column', () => {
    for (const entity of entityKeySchema.options) {
      const editorFields = new Set(
        entityDefinitions[entity].fields.map((field) => field.key),
      )
      const columns = new Set(Object.keys(getTableColumns(entityTables[entity])))
      const domainColumns = [...columns].filter(
        (column) =>
          !recordMetadataColumns.has(column) &&
          !managedElsewhereColumns[entity].has(column),
      )
      expect(
        domainColumns.filter((column) => !editorFields.has(column)),
        `${entity} has editable columns without editor fields`,
      ).toEqual([])
      expect(
        [...editorFields].filter((field) => !columns.has(field)),
        `${entity} has editor fields without matching columns`,
      ).toEqual([])
    }
  })
})
