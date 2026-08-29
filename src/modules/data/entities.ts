import { z } from 'zod'

export const entityKeySchema = z.enum([
  'dives',
  'sites',
  'divers',
  'buddies',
  'equipment',
  'certifications',
  'shops',
  'dive-types',
  'tanks',
  'profile-samples',
  'sync-runs',
])

export type EntityKey = z.infer<typeof entityKeySchema>
export type EditorValue = string | boolean | string[]
export type EditorValues = Record<string, EditorValue>

export interface EntityField {
  key: string
  label: string
  kind:
    | 'text'
    | 'textarea'
    | 'email'
    | 'tel'
    | 'date'
    | 'time'
    | 'number'
    | 'checkbox'
    | 'select'
    | 'multi-select'
  section: string
  required?: boolean
  reference?: EntityKey
  min?: number
  max?: number
  step?: string
  readOnly?: boolean
  help?: string
}

export interface EntityDefinition {
  key: EntityKey
  singular: string
  plural: string
  description: string
  mutable: boolean
  fields: EntityField[]
}

export const entityDefinitions: Record<EntityKey, EntityDefinition> = {
  dives: {
    key: 'dives',
    singular: 'Dive',
    plural: 'Dives',
    description: 'Logbook entries, conditions, relationships, and measurements.',
    mutable: true,
    fields: [
      {
        key: 'diverId',
        label: 'Diver',
        kind: 'select',
        section: 'Identity',
        reference: 'divers',
      },
      {
        key: 'siteId',
        label: 'Dive site',
        kind: 'select',
        section: 'Identity',
        reference: 'sites',
      },
      {
        key: 'shopId',
        label: 'Dive shop',
        kind: 'select',
        section: 'Identity',
        reference: 'shops',
      },
      {
        key: 'diveTypeId',
        label: 'Dive type',
        kind: 'select',
        section: 'Identity',
        reference: 'dive-types',
      },
      {
        key: 'number',
        label: 'Dive number',
        kind: 'number',
        section: 'Identity',
        min: 1,
        step: '1',
      },
      {
        key: 'diveDate',
        label: 'Dive date',
        kind: 'date',
        section: 'Timing',
        required: true,
      },
      { key: 'entryTime', label: 'Entry time', kind: 'time', section: 'Timing' },
      {
        key: 'utcOffsetMinutes',
        label: 'UTC offset (minutes)',
        kind: 'number',
        section: 'Timing',
        step: '1',
      },
      {
        key: 'durationSeconds',
        label: 'Duration (seconds)',
        kind: 'number',
        section: 'Timing',
        required: true,
        min: 0,
        step: '1',
      },
      {
        key: 'surfaceIntervalSeconds',
        label: 'Surface interval (seconds)',
        kind: 'number',
        section: 'Timing',
        min: 0,
        step: '1',
      },
      {
        key: 'maximumDepthMeters',
        label: 'Maximum depth (m)',
        kind: 'number',
        section: 'Measurements',
        min: 0,
        step: '0.01',
      },
      {
        key: 'averageDepthMeters',
        label: 'Average depth (m)',
        kind: 'number',
        section: 'Measurements',
        min: 0,
        step: '0.01',
      },
      {
        key: 'airTemperatureCelsius',
        label: 'Air temperature (°C)',
        kind: 'number',
        section: 'Measurements',
        step: '0.01',
      },
      {
        key: 'waterTemperatureCelsius',
        label: 'Water temperature (°C)',
        kind: 'number',
        section: 'Measurements',
        step: '0.01',
      },
      {
        key: 'weightKg',
        label: 'Weight (kg)',
        kind: 'number',
        section: 'Measurements',
        min: 0,
        step: '0.001',
      },
      { key: 'visibility', label: 'Visibility', kind: 'text', section: 'Conditions' },
      { key: 'current', label: 'Current', kind: 'text', section: 'Conditions' },
      { key: 'waves', label: 'Waves', kind: 'text', section: 'Conditions' },
      { key: 'weather', label: 'Weather', kind: 'text', section: 'Conditions' },
      {
        key: 'waterType',
        label: 'Water type code',
        kind: 'number',
        section: 'Conditions',
        step: '1',
      },
      {
        key: 'entryType',
        label: 'Entry type code',
        kind: 'number',
        section: 'Conditions',
        step: '1',
      },
      {
        key: 'rating',
        label: 'Rating',
        kind: 'number',
        section: 'Conditions',
        min: 1,
        max: 5,
        step: '1',
      },
      { key: 'computer', label: 'Dive computer', kind: 'text', section: 'Logbook' },
      { key: 'suit', label: 'Suit', kind: 'text', section: 'Logbook' },
      { key: 'boat', label: 'Boat', kind: 'text', section: 'Logbook' },
      { key: 'divemaster', label: 'Divemaster', kind: 'text', section: 'Logbook' },
      {
        key: 'buddyIds',
        label: 'Buddies',
        kind: 'multi-select',
        section: 'Relationships',
        reference: 'buddies',
      },
      {
        key: 'equipmentIds',
        label: 'Equipment',
        kind: 'multi-select',
        section: 'Relationships',
        reference: 'equipment',
      },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  sites: {
    key: 'sites',
    singular: 'Dive site',
    plural: 'Dive sites',
    description: 'Locations, coordinates, water bodies, and site conditions.',
    mutable: true,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', section: 'Identity', required: true },
      { key: 'country', label: 'Country', kind: 'text', section: 'Location' },
      { key: 'region', label: 'Region', kind: 'text', section: 'Location' },
      { key: 'waterName', label: 'Water name', kind: 'text', section: 'Location' },
      {
        key: 'latitude',
        label: 'Latitude',
        kind: 'number',
        section: 'Location',
        min: -90,
        max: 90,
        step: '0.0000001',
      },
      {
        key: 'longitude',
        label: 'Longitude',
        kind: 'number',
        section: 'Location',
        min: -180,
        max: 180,
        step: '0.0000001',
      },
      {
        key: 'maximumDepthMeters',
        label: 'Maximum depth (m)',
        kind: 'number',
        section: 'Site data',
        min: 0,
        step: '0.01',
      },
      {
        key: 'altitudeMeters',
        label: 'Altitude (m)',
        kind: 'number',
        section: 'Site data',
        step: '1',
      },
      { key: 'difficulty', label: 'Difficulty', kind: 'text', section: 'Site data' },
      {
        key: 'rating',
        label: 'Rating',
        kind: 'number',
        section: 'Site data',
        min: 1,
        max: 5,
        step: '1',
      },
      {
        key: 'waterType',
        label: 'Water type code',
        kind: 'number',
        section: 'Site data',
        step: '1',
      },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  divers: {
    key: 'divers',
    singular: 'Diver',
    plural: 'Divers',
    description: 'Diver profiles, emergency contacts, and personal logbook information.',
    mutable: true,
    fields: [
      { key: 'firstName', label: 'First name', kind: 'text', section: 'Personal' },
      { key: 'lastName', label: 'Last name', kind: 'text', section: 'Personal' },
      { key: 'birthDate', label: 'Birth date', kind: 'date', section: 'Personal' },
      { key: 'bloodGroup', label: 'Blood group', kind: 'text', section: 'Personal' },
      { key: 'email', label: 'Email', kind: 'email', section: 'Contact' },
      { key: 'phone', label: 'Phone', kind: 'tel', section: 'Contact' },
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
      { key: 'insurance', label: 'Insurance', kind: 'text', section: 'Emergency' },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  buddies: {
    key: 'buddies',
    singular: 'Buddy',
    plural: 'Buddies',
    description: 'People linked to dives as buddies.',
    mutable: true,
    fields: [
      { key: 'firstName', label: 'First name', kind: 'text', section: 'Identity' },
      { key: 'lastName', label: 'Last name', kind: 'text', section: 'Identity' },
      { key: 'email', label: 'Email', kind: 'email', section: 'Contact' },
      { key: 'phone', label: 'Phone', kind: 'tel', section: 'Contact' },
      { key: 'city', label: 'City', kind: 'text', section: 'Location' },
      { key: 'country', label: 'Country', kind: 'text', section: 'Location' },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  equipment: {
    key: 'equipment',
    singular: 'Equipment item',
    plural: 'Equipment',
    description: 'Owned gear, service dates, and dive assignments.',
    mutable: true,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', section: 'Identity', required: true },
      { key: 'category', label: 'Category', kind: 'text', section: 'Identity' },
      { key: 'manufacturer', label: 'Manufacturer', kind: 'text', section: 'Identity' },
      { key: 'model', label: 'Model', kind: 'text', section: 'Identity' },
      { key: 'serialNumber', label: 'Serial number', kind: 'text', section: 'Identity' },
      { key: 'purchasedAt', label: 'Purchased', kind: 'date', section: 'Lifecycle' },
      { key: 'serviceDueAt', label: 'Service due', kind: 'date', section: 'Lifecycle' },
      { key: 'retiredAt', label: 'Retired', kind: 'date', section: 'Lifecycle' },
      { key: 'inactive', label: 'Inactive', kind: 'checkbox', section: 'Lifecycle' },
      {
        key: 'weightKg',
        label: 'Weight (kg)',
        kind: 'number',
        section: 'Details',
        min: 0,
        step: '0.001',
      },
      { key: 'notes', label: 'Notes', kind: 'textarea', section: 'Notes' },
    ],
  },
  certifications: {
    key: 'certifications',
    singular: 'Certification',
    plural: 'Certifications',
    description: 'Diver training, agencies, instructors, and certification numbers.',
    mutable: true,
    fields: [
      {
        key: 'diverId',
        label: 'Diver',
        kind: 'select',
        section: 'Certification',
        reference: 'divers',
      },
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
        label: 'Certified date',
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
  shops: {
    key: 'shops',
    singular: 'Dive shop',
    plural: 'Dive shops',
    description: 'Dive centers and operators attached to logbook entries.',
    mutable: true,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', section: 'Identity', required: true },
    ],
  },
  'dive-types': {
    key: 'dive-types',
    singular: 'Dive type',
    plural: 'Dive types',
    description: 'Reusable dive categories and their display order.',
    mutable: true,
    fields: [
      { key: 'name', label: 'Name', kind: 'text', section: 'Identity', required: true },
      {
        key: 'sortOrder',
        label: 'Sort order',
        kind: 'number',
        section: 'Identity',
        step: '1',
      },
    ],
  },
  tanks: {
    key: 'tanks',
    singular: 'Tank',
    plural: 'Tanks',
    description: 'Per-dive cylinders, gas mixes, volumes, and pressures.',
    mutable: true,
    fields: [
      {
        key: 'diveId',
        label: 'Dive',
        kind: 'select',
        section: 'Assignment',
        required: true,
        reference: 'dives',
      },
      { key: 'name', label: 'Name', kind: 'text', section: 'Assignment' },
      {
        key: 'sortOrder',
        label: 'Sort order',
        kind: 'number',
        section: 'Assignment',
        step: '1',
      },
      {
        key: 'tankType',
        label: 'Tank type code',
        kind: 'number',
        section: 'Cylinder',
        step: '1',
      },
      {
        key: 'volumeLiters',
        label: 'Volume (L)',
        kind: 'number',
        section: 'Cylinder',
        min: 0,
        step: '0.01',
      },
      {
        key: 'startPressureBar',
        label: 'Start pressure (bar)',
        kind: 'number',
        section: 'Pressure',
        min: 0,
        step: '0.01',
      },
      {
        key: 'endPressureBar',
        label: 'End pressure (bar)',
        kind: 'number',
        section: 'Pressure',
        min: 0,
        step: '0.01',
      },
      {
        key: 'oxygenPercent',
        label: 'Oxygen (%)',
        kind: 'number',
        section: 'Gas',
        min: 0,
        max: 100,
        step: '0.01',
      },
      {
        key: 'heliumPercent',
        label: 'Helium (%)',
        kind: 'number',
        section: 'Gas',
        min: 0,
        max: 100,
        step: '0.01',
      },
      {
        key: 'breathingTimeSeconds',
        label: 'Breathing time (seconds)',
        kind: 'number',
        section: 'Gas',
        min: 0,
        step: '1',
      },
    ],
  },
  'profile-samples': {
    key: 'profile-samples',
    singular: 'Profile sample',
    plural: 'Profile samples',
    description: 'Time-ordered depth measurements used to draw each dive profile.',
    mutable: true,
    fields: [
      {
        key: 'diveId',
        label: 'Dive',
        kind: 'select',
        section: 'Assignment',
        required: true,
        reference: 'dives',
      },
      {
        key: 'sampleIndex',
        label: 'Sample index',
        kind: 'number',
        section: 'Measurement',
        required: true,
        min: 0,
        step: '1',
      },
      {
        key: 'elapsedSeconds',
        label: 'Elapsed time (seconds)',
        kind: 'number',
        section: 'Measurement',
        required: true,
        min: 0,
        step: '1',
      },
      {
        key: 'depthMeters',
        label: 'Depth (m)',
        kind: 'number',
        section: 'Measurement',
        required: true,
        min: 0,
        step: '0.01',
      },
    ],
  },
  'sync-runs': {
    key: 'sync-runs',
    singular: 'Sync run',
    plural: 'Sync runs',
    description: 'Immutable synchronization outcomes and diagnostic history.',
    mutable: false,
    fields: [
      { key: 'sourceKey', label: 'Source', kind: 'text', section: 'Run', readOnly: true },
      { key: 'trigger', label: 'Trigger', kind: 'text', section: 'Run', readOnly: true },
      { key: 'status', label: 'Status', kind: 'text', section: 'Run', readOnly: true },
      {
        key: 'startedAt',
        label: 'Started',
        kind: 'text',
        section: 'Timing',
        readOnly: true,
      },
      {
        key: 'finishedAt',
        label: 'Finished',
        kind: 'text',
        section: 'Timing',
        readOnly: true,
      },
      {
        key: 'sourceFingerprint',
        label: 'Source fingerprint',
        kind: 'text',
        section: 'Diagnostics',
        readOnly: true,
      },
      {
        key: 'counts',
        label: 'Imported counts',
        kind: 'textarea',
        section: 'Diagnostics',
        readOnly: true,
      },
      {
        key: 'error',
        label: 'Error',
        kind: 'textarea',
        section: 'Diagnostics',
        readOnly: true,
      },
    ],
  },
}

export const entityDefinitionList = entityKeySchema.options.map(
  (key) => entityDefinitions[key],
)
