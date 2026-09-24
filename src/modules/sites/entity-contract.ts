import {
  type EntityContract,
  nullableDecimalSchema,
  nullableIntegerSchema,
  nullableTextSchema,
  requiredTextSchema,
} from '@/modules/data/field-contract'

export type SiteInput = {
  name: string
  waterName: string | null
  region: string | null
  country: string | null
  latitude: string | null
  longitude: string | null
  maximumDepthMeters: string | null
  altitudeMeters: number | null
  waterType: number | null
  difficulty: string | null
  rating: number | null
  notes: string | null
}

export const siteContract: EntityContract<SiteInput> = {
  name: {
    presentation: { label: 'Name', kind: 'text', section: 'Site', required: true },
    mcpExposed: true,
    schema: requiredTextSchema('Name'),
  },
  waterName: {
    presentation: { label: 'Body of water', kind: 'text', section: 'Site' },
    mcpExposed: true,
    schema: nullableTextSchema('Body of water', 500),
  },
  region: {
    presentation: { label: 'Region', kind: 'text', section: 'Site' },
    mcpExposed: true,
    schema: nullableTextSchema('Region', 500),
  },
  country: {
    presentation: { label: 'Country', kind: 'text', section: 'Site' },
    mcpExposed: true,
    schema: nullableTextSchema('Country', 500),
  },
  latitude: {
    presentation: {
      label: 'Latitude',
      kind: 'number',
      section: 'Coordinates',
      min: -90,
      max: 90,
      step: '0.0000001',
    },
    mcpExposed: true,
    schema: nullableDecimalSchema('Latitude', { min: -90, max: 90 }),
  },
  longitude: {
    presentation: {
      label: 'Longitude',
      kind: 'number',
      section: 'Coordinates',
      min: -180,
      max: 180,
      step: '0.0000001',
    },
    mcpExposed: true,
    schema: nullableDecimalSchema('Longitude', { min: -180, max: 180 }),
  },
  maximumDepthMeters: {
    presentation: {
      label: 'Maximum depth (m)',
      kind: 'number',
      section: 'Character',
      min: 0,
      step: '0.01',
    },
    mcpExposed: true,
    schema: nullableDecimalSchema('Maximum depth', { min: 0 }),
  },
  altitudeMeters: {
    presentation: {
      label: 'Altitude (m)',
      kind: 'number',
      section: 'Character',
      step: '1',
    },
    mcpExposed: true,
    schema: nullableIntegerSchema('Altitude'),
  },
  waterType: {
    presentation: {
      label: 'Water',
      kind: 'select',
      section: 'Character',
      options: [
        { value: '1', label: 'Salt water' },
        { value: '2', label: 'Fresh water' },
      ],
    },
    mcpExposed: true,
    schema: nullableIntegerSchema('Water type', { min: 0 }),
  },
  difficulty: {
    presentation: { label: 'Difficulty', kind: 'text', section: 'Character' },
    mcpExposed: true,
    schema: nullableTextSchema('Difficulty', 500),
  },
  rating: {
    presentation: { label: 'Rating', kind: 'rating', section: 'Character' },
    mcpExposed: true,
    schema: nullableIntegerSchema('Rating', { min: 1, max: 5 }),
  },
  notes: {
    presentation: { label: 'Notes', kind: 'textarea', section: 'Notes' },
    mcpExposed: true,
    schema: nullableTextSchema('Notes'),
  },
}
