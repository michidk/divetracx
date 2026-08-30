import { describe, expect, test } from 'bun:test'
import { getTableColumns } from 'drizzle-orm'
import {
  buddies,
  certifications,
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
import { entityDefinitionList, entityDefinitions, entityKeySchema } from './entities'

const entityTables = {
  dives,
  sites: diveSites,
  divers,
  buddies,
  equipment,
  certifications,
  shops,
  'dive-types': diveTypes,
  tanks,
  'profile-samples': diveProfileSamples,
  'sync-runs': syncRuns,
} as const

const recordMetadataColumns = new Set([
  'id',
  'sourceKey',
  'externalId',
  'externalUuid',
  'sourceUpdatedAt',
  'sourcePayload',
  'createdAt',
  'updatedAt',
])

describe('data entity definitions', () => {
  test('defines every entity exactly once', () => {
    expect(entityDefinitionList).toHaveLength(entityKeySchema.options.length)
    expect(new Set(entityDefinitionList.map((item) => item.key)).size).toBe(
      entityKeySchema.options.length,
    )
  })

  test('uses unique fields and valid references', () => {
    for (const definition of entityDefinitionList) {
      const fieldKeys = definition.fields.map((field) => field.key)
      expect(new Set(fieldKeys).size).toBe(fieldKeys.length)
      for (const field of definition.fields) {
        expect(field.section.length).toBeGreaterThan(0)
        if (field.reference) expect(entityDefinitions[field.reference]).toBeDefined()
      }
    }
  })

  test('manages dive join tables through relationship fields', () => {
    const diveFields = new Map(
      entityDefinitions.dives.fields.map((field) => [field.key, field]),
    )
    expect(diveFields.get('buddyIds')).toMatchObject({
      kind: 'multi-select',
      reference: 'buddies',
    })
    expect(diveFields.get('equipmentIds')).toMatchObject({
      kind: 'multi-select',
      reference: 'equipment',
    })
  })

  test('provides an editor field for every domain column', () => {
    for (const entity of entityKeySchema.options) {
      const editorFields = new Set(
        entityDefinitions[entity].fields.map((field) => field.key),
      )
      const domainColumns = Object.keys(getTableColumns(entityTables[entity])).filter(
        (column) => !recordMetadataColumns.has(column),
      )
      expect(
        domainColumns.filter((column) => !editorFields.has(column)),
        `${entity} has domain columns without editor fields`,
      ).toEqual([])
    }
  })

  test('keeps synchronization audit records read-only', () => {
    expect(entityDefinitions['sync-runs'].mutable).toBeFalse()
    expect(
      entityDefinitionList
        .filter((definition) => definition.key !== 'sync-runs')
        .every((definition) => definition.mutable),
    ).toBeTrue()
  })
})
