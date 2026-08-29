import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const sourceColumns = {
  sourceKey: text('source_key').notNull().default('manual'),
  externalId: text('external_id'),
  externalUuid: text('external_uuid'),
  sourceUpdatedAt: text('source_updated_at'),
  sourcePayload: jsonb('source_payload').$type<Record<string, unknown>>(),
}

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const divers = pgTable(
  'divers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    email: text('email'),
    phone: text('phone'),
    birthDate: date('birth_date'),
    bloodGroup: text('blood_group'),
    emergencyContact: text('emergency_contact'),
    emergencyPhone: text('emergency_phone'),
    insurance: text('insurance'),
    notes: text('notes'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('divers_source_external_id_unique').on(table.sourceKey, table.externalId),
  ],
)

export const diveSites = pgTable(
  'dive_sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    country: text('country'),
    region: text('region'),
    waterName: text('water_name'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    sourceLatitude: text('source_latitude'),
    sourceLongitude: text('source_longitude'),
    maximumDepthMeters: numeric('maximum_depth_meters', {
      precision: 7,
      scale: 2,
    }),
    altitudeMeters: integer('altitude_meters'),
    difficulty: text('difficulty'),
    rating: integer('rating'),
    waterType: integer('water_type'),
    notes: text('notes'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('dive_sites_source_external_id_unique').on(
      table.sourceKey,
      table.externalId,
    ),
    index('dive_sites_name_index').on(table.name),
  ],
)

export const buddies = pgTable(
  'buddies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    email: text('email'),
    phone: text('phone'),
    city: text('city'),
    country: text('country'),
    notes: text('notes'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('buddies_source_external_id_unique').on(
      table.sourceKey,
      table.externalId,
    ),
  ],
)

export const shops = pgTable(
  'shops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('shops_source_external_id_unique').on(table.sourceKey, table.externalId),
  ],
)

export const equipment = pgTable(
  'equipment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    category: text('category'),
    manufacturer: text('manufacturer'),
    model: text('model'),
    serialNumber: text('serial_number'),
    purchasedAt: date('purchased_at'),
    retiredAt: date('retired_at'),
    serviceDueAt: date('service_due_at'),
    inactive: boolean('inactive').notNull().default(false),
    weightKg: numeric('weight_kg', { precision: 7, scale: 3 }),
    notes: text('notes'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('equipment_source_external_id_unique').on(
      table.sourceKey,
      table.externalId,
    ),
  ],
)

export const certifications = pgTable(
  'certifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diverId: uuid('diver_id').references(() => divers.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    organization: text('organization'),
    certificationNumber: text('certification_number'),
    certifiedAt: date('certified_at'),
    instructorName: text('instructor_name'),
    instructorNumber: text('instructor_number'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('certifications_source_external_id_unique').on(
      table.sourceKey,
      table.externalId,
    ),
  ],
)

export const diveTypes = pgTable(
  'dive_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('dive_types_source_external_id_unique').on(
      table.sourceKey,
      table.externalId,
    ),
  ],
)

export const dives = pgTable(
  'dives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diverId: uuid('diver_id').references(() => divers.id, {
      onDelete: 'set null',
    }),
    siteId: uuid('site_id').references(() => diveSites.id, {
      onDelete: 'set null',
    }),
    shopId: uuid('shop_id').references(() => shops.id, {
      onDelete: 'set null',
    }),
    diveTypeId: uuid('dive_type_id').references(() => diveTypes.id, {
      onDelete: 'set null',
    }),
    number: integer('number'),
    diveDate: date('dive_date').notNull(),
    entryTime: time('entry_time'),
    utcOffsetMinutes: integer('utc_offset_minutes'),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    surfaceIntervalSeconds: integer('surface_interval_seconds'),
    maximumDepthMeters: numeric('maximum_depth_meters', {
      precision: 7,
      scale: 2,
    }),
    averageDepthMeters: numeric('average_depth_meters', {
      precision: 7,
      scale: 2,
    }),
    airTemperatureCelsius: numeric('air_temperature_celsius', {
      precision: 5,
      scale: 2,
    }),
    waterTemperatureCelsius: numeric('water_temperature_celsius', {
      precision: 5,
      scale: 2,
    }),
    weightKg: numeric('weight_kg', { precision: 7, scale: 3 }),
    visibility: text('visibility'),
    current: text('current'),
    waves: text('waves'),
    weather: text('weather'),
    waterType: integer('water_type'),
    entryType: integer('entry_type'),
    rating: integer('rating'),
    computer: text('computer'),
    suit: text('suit'),
    boat: text('boat'),
    divemaster: text('divemaster'),
    notes: text('notes'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('dives_source_external_id_unique').on(table.sourceKey, table.externalId),
    index('dives_dive_date_index').on(table.diveDate),
    index('dives_site_id_index').on(table.siteId),
  ],
)

export const diveProfileSamples = pgTable(
  'dive_profile_samples',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diveId: uuid('dive_id')
      .notNull()
      .references(() => dives.id, { onDelete: 'cascade' }),
    sampleIndex: integer('sample_index').notNull(),
    elapsedSeconds: integer('elapsed_seconds').notNull(),
    depthMeters: numeric('depth_meters', { precision: 7, scale: 2 }).notNull(),
    temperatureCelsius: numeric('temperature_celsius', { precision: 5, scale: 2 }),
    pressureBar: numeric('pressure_bar', { precision: 7, scale: 2 }),
    decoCeilingMeters: numeric('deco_ceiling_meters', { precision: 7, scale: 2 }),
    tankNumber: integer('tank_number'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('dive_profile_samples_dive_source_index_unique').on(
      table.diveId,
      table.sourceKey,
      table.sampleIndex,
    ),
    index('dive_profile_samples_dive_elapsed_index').on(
      table.diveId,
      table.elapsedSeconds,
    ),
  ],
)

export const diveBuddies = pgTable(
  'dive_buddies',
  {
    diveId: uuid('dive_id')
      .notNull()
      .references(() => dives.id, { onDelete: 'cascade' }),
    buddyId: uuid('buddy_id')
      .notNull()
      .references(() => buddies.id, { onDelete: 'cascade' }),
    sourceKey: text('source_key').notNull().default('manual'),
  },
  (table) => [primaryKey({ columns: [table.diveId, table.buddyId, table.sourceKey] })],
)

export const diveEquipment = pgTable(
  'dive_equipment',
  {
    diveId: uuid('dive_id')
      .notNull()
      .references(() => dives.id, { onDelete: 'cascade' }),
    equipmentId: uuid('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    sourceKey: text('source_key').notNull().default('manual'),
  },
  (table) => [
    primaryKey({ columns: [table.diveId, table.equipmentId, table.sourceKey] }),
  ],
)

export const tanks = pgTable(
  'tanks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diveId: uuid('dive_id')
      .notNull()
      .references(() => dives.id, { onDelete: 'cascade' }),
    name: text('name'),
    sortOrder: integer('sort_order'),
    computerTankNumber: integer('computer_tank_number'),
    tankType: integer('tank_type'),
    volumeLiters: numeric('volume_liters', { precision: 7, scale: 2 }),
    startPressureBar: numeric('start_pressure_bar', {
      precision: 7,
      scale: 2,
    }),
    endPressureBar: numeric('end_pressure_bar', { precision: 7, scale: 2 }),
    oxygenPercent: numeric('oxygen_percent', { precision: 5, scale: 2 }),
    heliumPercent: numeric('helium_percent', { precision: 5, scale: 2 }),
    breathingTimeSeconds: integer('breathing_time_seconds'),
    ...sourceColumns,
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('tanks_source_external_id_unique').on(table.sourceKey, table.externalId),
    index('tanks_dive_id_index').on(table.diveId),
  ],
)

export const syncRunStatus = pgEnum('sync_run_status', ['running', 'succeeded', 'failed'])

export const syncRunTrigger = pgEnum('sync_run_trigger', ['manual', 'schedule', 'cli'])

export const syncRuns = pgTable(
  'sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceKey: text('source_key').notNull(),
    trigger: syncRunTrigger('trigger').notNull().default('manual'),
    status: syncRunStatus('status').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    sourceFingerprint: text('source_fingerprint'),
    counts: jsonb('counts').$type<Record<string, number>>(),
    error: text('error'),
  },
  (table) => [index('sync_runs_started_at_index').on(table.startedAt)],
)
