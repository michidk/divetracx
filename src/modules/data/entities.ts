import { z } from 'zod'

export const entityKeySchema = z.enum([
  'sites',
  'divers',
  'buddies',
  'equipment',
  'certifications',
])

export type EntityKey = z.infer<typeof entityKeySchema>
export type EditorValue = string | boolean
export type EditorValues = Record<string, EditorValue>

export interface EntityField {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'email' | 'tel' | 'date' | 'number' | 'checkbox' | 'rating'
  section: string
  required?: boolean
  min?: number
  max?: number
  step?: string
  help?: string
}

export interface EntityDefinition {
  key: EntityKey
  singular: string
  plural: string
  fields: EntityField[]
}

export const entityDefinitions: Record<EntityKey, EntityDefinition> = {
  sites: {
    key: 'sites',
    singular: 'Dive site',
    plural: 'Dive sites',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', section: 'Site', required: true },
      { key: 'waterName', label: 'Body of water', kind: 'text', section: 'Site' },
      { key: 'region', label: 'Region', kind: 'text', section: 'Site' },
      { key: 'country', label: 'Country', kind: 'text', section: 'Site' },
      {
        key: 'latitude',
        label: 'Latitude',
        kind: 'number',
        section: 'Coordinates',
        min: -90,
        max: 90,
        step: '0.0000001',
      },
      {
        key: 'longitude',
        label: 'Longitude',
        kind: 'number',
        section: 'Coordinates',
        min: -180,
        max: 180,
        step: '0.0000001',
      },
      {
        key: 'maximumDepthMeters',
        label: 'Maximum depth (m)',
        kind: 'number',
        section: 'Character',
        min: 0,
        step: '0.01',
      },
      {
        key: 'altitudeMeters',
        label: 'Altitude (m)',
        kind: 'number',
        section: 'Character',
        step: '1',
      },
      { key: 'difficulty', label: 'Difficulty', kind: 'text', section: 'Character' },
      { key: 'rating', label: 'Rating', kind: 'rating', section: 'Character' },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  divers: {
    key: 'divers',
    singular: 'Diver',
    plural: 'Divers',
    fields: [
      { key: 'firstName', label: 'First name', kind: 'text', section: 'Personal' },
      { key: 'lastName', label: 'Last name', kind: 'text', section: 'Personal' },
      { key: 'birthDate', label: 'Birth date', kind: 'date', section: 'Personal' },
      { key: 'bloodGroup', label: 'Blood group', kind: 'text', section: 'Personal' },
      { key: 'email', label: 'Email', kind: 'email', section: 'Contact' },
      { key: 'phone', label: 'Phone', kind: 'tel', section: 'Contact' },
      { key: 'street', label: 'Street', kind: 'text', section: 'Address' },
      { key: 'postalCode', label: 'Postal code', kind: 'text', section: 'Address' },
      { key: 'city', label: 'City', kind: 'text', section: 'Address' },
      { key: 'state', label: 'State / province', kind: 'text', section: 'Address' },
      { key: 'country', label: 'Country', kind: 'text', section: 'Address' },
      {
        key: 'emergencyContact',
        label: 'Emergency contact',
        kind: 'text',
        section: 'Emergency',
      },
      {
        key: 'emergencyPhone',
        label: 'Emergency phone',
        kind: 'tel',
        section: 'Emergency',
      },
      {
        key: 'emergencyEmail',
        label: 'Emergency email',
        kind: 'email',
        section: 'Emergency',
      },
      { key: 'insurance', label: 'Insurance', kind: 'text', section: 'Emergency' },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  buddies: {
    key: 'buddies',
    singular: 'Buddy',
    plural: 'Buddies',
    fields: [
      { key: 'firstName', label: 'First name', kind: 'text', section: 'Person' },
      { key: 'lastName', label: 'Last name', kind: 'text', section: 'Person' },
      { key: 'email', label: 'Email', kind: 'email', section: 'Contact' },
      { key: 'phone', label: 'Phone', kind: 'tel', section: 'Contact' },
      { key: 'street', label: 'Street', kind: 'text', section: 'Address' },
      { key: 'postalCode', label: 'Postal code', kind: 'text', section: 'Address' },
      { key: 'city', label: 'City', kind: 'text', section: 'Address' },
      { key: 'state', label: 'State / province', kind: 'text', section: 'Address' },
      { key: 'country', label: 'Country', kind: 'text', section: 'Address' },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  equipment: {
    key: 'equipment',
    singular: 'Gear item',
    plural: 'Gear',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', section: 'Item', required: true },
      { key: 'category', label: 'Category', kind: 'text', section: 'Item' },
      { key: 'manufacturer', label: 'Manufacturer', kind: 'text', section: 'Item' },
      { key: 'model', label: 'Model', kind: 'text', section: 'Item' },
      { key: 'serialNumber', label: 'Serial number', kind: 'text', section: 'Item' },
      { key: 'information', label: 'Information', kind: 'text', section: 'Item' },
      {
        key: 'weightKg',
        label: 'Weight (kg)',
        kind: 'number',
        section: 'Item',
        min: 0,
        step: '0.001',
      },
      { key: 'purchasedAt', label: 'Purchased', kind: 'date', section: 'Ownership' },
      {
        key: 'purchasePrice',
        label: 'Purchase price',
        kind: 'number',
        section: 'Ownership',
        min: 0,
        step: '0.01',
      },
      { key: 'purchaseShop', label: 'Bought at', kind: 'text', section: 'Ownership' },
      {
        key: 'serviceDueAt',
        label: 'Next service due',
        kind: 'date',
        section: 'Service',
      },
      { key: 'retiredAt', label: 'Retired', kind: 'date', section: 'Service' },
      {
        key: 'inactive',
        label: 'No longer in use',
        kind: 'checkbox',
        section: 'Service',
      },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  certifications: {
    key: 'certifications',
    singular: 'Certification',
    plural: 'Certifications',
    fields: [
      {
        key: 'name',
        label: 'Name',
        kind: 'text',
        section: 'Certification',
        required: true,
      },
      {
        key: 'organization',
        label: 'Organization',
        kind: 'text',
        section: 'Certification',
      },
      {
        key: 'certificationNumber',
        label: 'Certification number',
        kind: 'text',
        section: 'Certification',
      },
      {
        key: 'certifiedAt',
        label: 'Certified on',
        kind: 'date',
        section: 'Certification',
      },
      { key: 'instructorName', label: 'Instructor', kind: 'text', section: 'Instructor' },
      {
        key: 'instructorNumber',
        label: 'Instructor number',
        kind: 'text',
        section: 'Instructor',
      },
    ],
  },
}

export const entityDefinitionList = entityKeySchema.options.map(
  (key) => entityDefinitions[key],
)
