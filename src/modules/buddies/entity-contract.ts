import {
  booleanSchema,
  type EntityContract,
  nullableIntegerSchema,
  nullableTextSchema,
} from '@/modules/data/field-contract'

export type BuddyInput = {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  state: string | null
  country: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  emergencyEmail: string | null
  instructor: boolean
  minimumDives: number | null
  notes: string | null
}

export const buddyContract: EntityContract<BuddyInput> = {
  firstName: {
    presentation: { label: 'First name', kind: 'text', section: 'Person' },
    mcpExposed: true,
    schema: nullableTextSchema('First name', 500),
  },
  lastName: {
    presentation: { label: 'Last name', kind: 'text', section: 'Person' },
    mcpExposed: true,
    schema: nullableTextSchema('Last name', 500),
  },
  email: {
    presentation: { label: 'Email', kind: 'email', section: 'Contact' },
    mcpExposed: true,
    schema: nullableTextSchema('Email', 500),
  },
  phone: {
    presentation: { label: 'Phone', kind: 'tel', section: 'Contact' },
    mcpExposed: true,
    schema: nullableTextSchema('Phone', 500),
  },
  street: {
    presentation: { label: 'Street', kind: 'text', section: 'Address' },
    mcpExposed: true,
    schema: nullableTextSchema('Street', 500),
  },
  postalCode: {
    presentation: { label: 'Postal code', kind: 'text', section: 'Address' },
    mcpExposed: true,
    schema: nullableTextSchema('Postal code', 500),
  },
  city: {
    presentation: { label: 'City', kind: 'text', section: 'Address' },
    mcpExposed: true,
    schema: nullableTextSchema('City', 500),
  },
  state: {
    presentation: { label: 'State / province', kind: 'text', section: 'Address' },
    mcpExposed: true,
    schema: nullableTextSchema('State / province', 500),
  },
  country: {
    presentation: { label: 'Country', kind: 'text', section: 'Address' },
    mcpExposed: true,
    schema: nullableTextSchema('Country', 500),
  },
  emergencyContact: {
    presentation: { label: 'Contact', kind: 'text', section: 'Emergency Contact' },
    mcpExposed: true,
    schema: nullableTextSchema('Emergency contact', 500),
  },
  emergencyPhone: {
    presentation: { label: 'Phone', kind: 'tel', section: 'Emergency Contact' },
    mcpExposed: true,
    schema: nullableTextSchema('Emergency phone', 500),
  },
  emergencyEmail: {
    presentation: { label: 'Email', kind: 'email', section: 'Emergency Contact' },
    mcpExposed: true,
    schema: nullableTextSchema('Emergency email', 500),
  },
  instructor: {
    presentation: { label: 'Instructor', kind: 'checkbox', section: 'Experience' },
    mcpExposed: true,
    schema: booleanSchema(),
  },
  minimumDives: {
    presentation: {
      label: 'Minimum known dives',
      kind: 'number',
      section: 'Experience',
      min: 0,
      step: '1',
      help: 'The number of dives this buddy is known to have completed at minimum.',
    },
    mcpExposed: true,
    schema: nullableIntegerSchema('Minimum known dives', { min: 0 }),
  },
  notes: {
    presentation: { label: 'Notes', kind: 'textarea', section: 'Notes' },
    mcpExposed: true,
    schema: nullableTextSchema('Notes'),
  },
}
