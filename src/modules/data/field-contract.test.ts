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
import {
  buddyAgencyMembershipContract,
  buddyCertificationContract,
} from '@/modules/buddies/credential-contracts'
import { buddyContract } from '@/modules/buddies/entity-contract'
import { equipmentContract } from '@/modules/gear/entity-contract'
import {
  agencyMembershipContract,
  certificationContract,
} from '@/modules/profile/credential-contracts'
import { diverContract } from '@/modules/profile/entity-contract'
import { siteContract } from '@/modules/sites/entity-contract'
import { type EntityContract, mcpValuesSchema } from './field-contract'

const recordMetadataColumns = new Set(['id', 'createdAt', 'updatedAt'])

// Columns that exist in the schema but are intentionally not user-editable:
// they are either assigned automatically, preserved for import round-trips,
// or managed through a different editor (the dive editor, the featured-card
// toggle) than the generic contract-driven forms this checks.
const entities: Array<{
  name: string
  table: Parameters<typeof getTableColumns>[0]
  contract: EntityContract<Record<string, unknown>>
  managedElsewhere: Set<string>
}> = [
  {
    name: 'sites',
    table: diveSites,
    contract: siteContract,
    managedElsewhere: new Set(),
  },
  { name: 'divers', table: divers, contract: diverContract, managedElsewhere: new Set() },
  {
    name: 'buddies',
    table: buddies,
    contract: buddyContract,
    managedElsewhere: new Set(),
  },
  {
    name: 'equipment',
    table: equipment,
    contract: equipmentContract,
    managedElsewhere: new Set(['diverId']),
  },
  {
    name: 'certifications',
    table: certifications,
    contract: certificationContract,
    managedElsewhere: new Set([
      'diverId',
      'featuredOnCard',
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
  },
  {
    name: 'agencyMemberships',
    table: agencyMemberships,
    contract: agencyMembershipContract,
    managedElsewhere: new Set(['diverId']),
  },
  {
    name: 'buddyCertifications',
    table: buddyCertifications,
    contract: buddyCertificationContract,
    managedElsewhere: new Set(['buddyId']),
  },
  {
    name: 'buddyAgencyMemberships',
    table: buddyAgencyMemberships,
    contract: buddyAgencyMembershipContract,
    managedElsewhere: new Set(['buddyId']),
  },
]

function asRecordContract<T extends Record<string, unknown>>(
  contract: EntityContract<T>,
): EntityContract<Record<string, unknown>> {
  return contract as unknown as EntityContract<Record<string, unknown>>
}

const mcpExposedEntities: Array<{
  name: string
  contract: EntityContract<Record<string, unknown>>
}> = [
  { name: 'sites', contract: asRecordContract(siteContract) },
  { name: 'divers', contract: asRecordContract(diverContract) },
  { name: 'buddies', contract: asRecordContract(buddyContract) },
  { name: 'equipment', contract: asRecordContract(equipmentContract) },
]

describe('entity field contracts', () => {
  test('use unique field keys and non-empty presentation sections', () => {
    for (const entity of entities) {
      const keys = Object.keys(entity.contract)
      expect(new Set(keys).size).toBe(keys.length)
      for (const field of Object.values(entity.contract)) {
        expect(field.presentation.section.length).toBeGreaterThan(0)
        expect(field.presentation.label.length).toBeGreaterThan(0)
      }
    }
  })

  test('cover every user-editable domain column, and declare no others', () => {
    for (const entity of entities) {
      const contractFields = new Set(Object.keys(entity.contract))
      const columns = new Set(Object.keys(getTableColumns(entity.table)))
      const domainColumns = [...columns].filter(
        (column) =>
          !recordMetadataColumns.has(column) && !entity.managedElsewhere.has(column),
      )
      expect(
        domainColumns.filter((column) => !contractFields.has(column)),
        `${entity.name} has editable columns without a contract field`,
      ).toEqual([])
      expect(
        [...contractFields].filter((field) => !columns.has(field)),
        `${entity.name} has contract fields without a matching column`,
      ).toEqual([])
    }
  })

  test('every field marked mcpExposed is actually writable through the derived MCP schema', () => {
    for (const entity of mcpExposedEntities) {
      const schema = mcpValuesSchema(entity.contract)
      const schemaKeys = new Set(Object.keys(schema.shape))
      for (const [key, field] of Object.entries(entity.contract)) {
        expect(
          schemaKeys.has(key),
          `${entity.name}.${key} is mcpExposed=${field.mcpExposed} but ${
            field.mcpExposed ? 'is missing from' : 'appears in'
          } the derived MCP schema`,
        ).toBe(field.mcpExposed)
      }
    }
  })

  test('buddy emergency-contact fields and profile card-visibility flags are MCP-writable (previously drifted out)', () => {
    const buddySchema = mcpValuesSchema(buddyContract)
    for (const key of ['emergencyContact', 'emergencyPhone', 'emergencyEmail']) {
      expect(Object.keys(buddySchema.shape)).toContain(key)
    }
    const profileSchema = mcpValuesSchema(diverContract)
    for (const key of ['showEmergencyOnCard', 'showInsuranceOnCard']) {
      expect(Object.keys(profileSchema.shape)).toContain(key)
    }
  })
})
