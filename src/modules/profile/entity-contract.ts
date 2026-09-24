import {
  booleanSchema,
  type EntityContract,
  nullableDateSchema,
  nullableTextSchema,
} from '@/modules/data/field-contract'

export type DiverInput = {
  firstName: string | null
  lastName: string | null
  birthDate: string | null
  bloodGroup: string | null
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
  showEmergencyOnCard: boolean
  insurance: string | null
  insuranceTariff: string | null
  insuranceNumber: string | null
  insuranceHotline: string | null
  showInsuranceOnCard: boolean
  notes: string | null
}

const bloodGroupOptions = ['0-', '0+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(
  (group) => ({
    value: group,
    label: group,
  }),
)

export const diverContract: EntityContract<DiverInput> = {
  firstName: {
    presentation: { label: 'First name', kind: 'text', section: 'Personal' },
    mcpExposed: true,
    schema: nullableTextSchema('First name', 500),
  },
  lastName: {
    presentation: { label: 'Last name', kind: 'text', section: 'Personal' },
    mcpExposed: true,
    schema: nullableTextSchema('Last name', 500),
  },
  birthDate: {
    presentation: { label: 'Birth date', kind: 'date-picker', section: 'Personal' },
    mcpExposed: true,
    schema: nullableDateSchema('Birth date'),
  },
  bloodGroup: {
    presentation: {
      label: 'Blood group',
      kind: 'select',
      section: 'Personal',
      options: bloodGroupOptions,
    },
    mcpExposed: true,
    schema: nullableTextSchema('Blood group', 10),
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
  showEmergencyOnCard: {
    presentation: {
      label: 'Include on Diver Profile card',
      kind: 'checkbox',
      section: 'Emergency Contact',
      defaultValue: true,
    },
    mcpExposed: true,
    schema: booleanSchema(),
  },
  insurance: {
    presentation: { label: 'Insurer', kind: 'text', section: 'Insurance' },
    mcpExposed: true,
    schema: nullableTextSchema('Insurer', 500),
  },
  insuranceTariff: {
    presentation: { label: 'Plan', kind: 'text', section: 'Insurance' },
    mcpExposed: true,
    schema: nullableTextSchema('Plan', 500),
  },
  insuranceNumber: {
    presentation: { label: 'Policy number', kind: 'text', section: 'Insurance' },
    mcpExposed: true,
    schema: nullableTextSchema('Policy number', 500),
  },
  insuranceHotline: {
    presentation: { label: 'Emergency hotline', kind: 'tel', section: 'Insurance' },
    mcpExposed: true,
    schema: nullableTextSchema('Emergency hotline', 500),
  },
  showInsuranceOnCard: {
    presentation: {
      label: 'Include on Diver Profile card',
      kind: 'checkbox',
      section: 'Insurance',
      defaultValue: true,
    },
    mcpExposed: true,
    schema: booleanSchema(),
  },
  notes: {
    presentation: { label: 'Notes', kind: 'textarea', section: 'Notes' },
    mcpExposed: true,
    schema: nullableTextSchema('Notes'),
  },
}
