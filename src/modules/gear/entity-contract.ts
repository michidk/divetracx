import {
  booleanSchema,
  type EntityContract,
  nullableDateSchema,
  nullableDecimalSchema,
  nullableTextSchema,
  requiredTextSchema,
} from '@/modules/data/field-contract'

export type EquipmentInput = {
  name: string
  category: string | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  information: string | null
  weightKg: string | null
  purchasedAt: string | null
  purchasePrice: string | null
  purchaseShop: string | null
  serviceDueAt: string | null
  retiredAt: string | null
  inactive: boolean
  notes: string | null
}

export const equipmentContract: EntityContract<EquipmentInput> = {
  name: {
    presentation: { label: 'Name', kind: 'text', section: 'Item', required: true },
    mcpExposed: true,
    schema: requiredTextSchema('Name'),
  },
  category: {
    presentation: { label: 'Category', kind: 'text', section: 'Item' },
    mcpExposed: true,
    schema: nullableTextSchema('Category', 500),
  },
  manufacturer: {
    presentation: { label: 'Manufacturer', kind: 'text', section: 'Item' },
    mcpExposed: true,
    schema: nullableTextSchema('Manufacturer', 500),
  },
  model: {
    presentation: { label: 'Model', kind: 'text', section: 'Item' },
    mcpExposed: true,
    schema: nullableTextSchema('Model', 500),
  },
  serialNumber: {
    presentation: { label: 'Serial number', kind: 'text', section: 'Item' },
    mcpExposed: true,
    schema: nullableTextSchema('Serial number', 500),
  },
  information: {
    presentation: { label: 'Information', kind: 'text', section: 'Item' },
    mcpExposed: true,
    schema: nullableTextSchema('Information'),
  },
  weightKg: {
    presentation: {
      label: 'Weight (kg)',
      kind: 'number',
      section: 'Item',
      min: 0,
      step: '0.001',
    },
    mcpExposed: true,
    schema: nullableDecimalSchema('Weight', { min: 0 }),
  },
  purchasedAt: {
    presentation: { label: 'Purchased', kind: 'date', section: 'Ownership' },
    mcpExposed: true,
    schema: nullableDateSchema('Purchased'),
  },
  purchasePrice: {
    presentation: {
      label: 'Purchase price',
      kind: 'number',
      section: 'Ownership',
      min: 0,
      step: '0.01',
    },
    mcpExposed: true,
    schema: nullableDecimalSchema('Purchase price', { min: 0 }),
  },
  purchaseShop: {
    presentation: { label: 'Bought at', kind: 'text', section: 'Ownership' },
    mcpExposed: true,
    schema: nullableTextSchema('Bought at', 500),
  },
  serviceDueAt: {
    presentation: { label: 'Next service due', kind: 'date', section: 'Service' },
    mcpExposed: true,
    schema: nullableDateSchema('Next service due'),
  },
  retiredAt: {
    presentation: { label: 'Retired', kind: 'date', section: 'Service' },
    mcpExposed: true,
    schema: nullableDateSchema('Retired'),
  },
  inactive: {
    presentation: { label: 'No longer in use', kind: 'checkbox', section: 'Service' },
    mcpExposed: true,
    schema: booleanSchema(),
  },
  notes: {
    presentation: { label: 'Notes', kind: 'textarea', section: 'Notes' },
    mcpExposed: true,
    schema: nullableTextSchema('Notes'),
  },
}
