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
import { DIVE_BUDDY_ROLE_VALUES } from '@/modules/dives/buddy-role'

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const diveCaptureSource = pgEnum('dive_capture_source', ['manual', 'computer'])
export const diveBuddyRole = pgEnum('dive_buddy_role', DIVE_BUDDY_ROLE_VALUES)

export const divers = pgTable('divers', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  street: text('street'),
  postalCode: text('postal_code'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  birthDate: date('birth_date'),
  bloodGroup: text('blood_group'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  emergencyEmail: text('emergency_email'),
  showEmergencyOnCard: boolean('show_emergency_on_card').notNull().default(true),
  insurance: text('insurance'),
  insuranceTariff: text('insurance_tariff'),
  insuranceNumber: text('insurance_number'),
  insuranceHotline: text('insurance_hotline'),
  showInsuranceOnCard: boolean('show_insurance_on_card').notNull().default(true),
  notes: text('notes'),
  ...auditColumns,
})

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
    maximumDepthMeters: numeric('maximum_depth_meters', {
      precision: 7,
      scale: 2,
    }),
    altitudeMeters: integer('altitude_meters'),
    difficulty: text('difficulty'),
    rating: integer('rating'),
    waterType: integer('water_type'),
    notes: text('notes'),
    ...auditColumns,
  },
  (table) => [index('dive_sites_name_index').on(table.name)],
)

export const buddies = pgTable('buddies', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  street: text('street'),
  postalCode: text('postal_code'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),
  emergencyEmail: text('emergency_email'),
  instructor: boolean('instructor').notNull().default(false),
  minimumDives: integer('minimum_dives'),
  notes: text('notes'),
  ...auditColumns,
})

export const shops = pgTable('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...auditColumns,
})

export const boats = pgTable('boats', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...auditColumns,
})

export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  diverId: uuid('diver_id').references(() => divers.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  category: text('category'),
  manufacturer: text('manufacturer'),
  model: text('model'),
  serialNumber: text('serial_number'),
  information: text('information'),
  purchasedAt: date('purchased_at'),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }),
  purchaseShop: text('purchase_shop'),
  retiredAt: date('retired_at'),
  serviceDueAt: date('service_due_at'),
  inactive: boolean('inactive').notNull().default(false),
  weightKg: numeric('weight_kg', { precision: 7, scale: 3 }),
  notes: text('notes'),
  ...auditColumns,
})

export const equipmentSets = pgTable('equipment_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  notes: text('notes'),
  inactive: boolean('inactive').notNull().default(false),
  ...auditColumns,
})

export const equipmentSetItems = pgTable(
  'equipment_set_items',
  {
    equipmentSetId: uuid('equipment_set_id')
      .notNull()
      .references(() => equipmentSets.id, { onDelete: 'cascade' }),
    equipmentId: uuid('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.equipmentSetId, table.equipmentId] }),
    index('equipment_set_items_equipment_index').on(table.equipmentId),
  ],
)

export const agencies = pgTable(
  'agencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code'),
    name: text('name').notNull(),
    fullName: text('full_name'),
    normalizedName: text('normalized_name').notNull(),
    logoSrc: text('logo_src'),
    websiteUrl: text('website_url'),
    loginUrl: text('login_url'),
    darkLogo: boolean('dark_logo').notNull().default(false),
    builtIn: boolean('built_in').notNull().default(false),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('agencies_code_unique').on(table.code),
    uniqueIndex('agencies_normalized_name_unique').on(table.normalizedName),
  ],
)

export const buddyCertifications = pgTable(
  'buddy_certifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buddyId: uuid('buddy_id')
      .notNull()
      .references(() => buddies.id, { onDelete: 'cascade' }),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    ...auditColumns,
  },
  (table) => [
    index('buddy_certifications_buddy_id_index').on(table.buddyId),
    index('buddy_certifications_agency_id_index').on(table.agencyId),
  ],
)

export const buddyAgencyMemberships = pgTable(
  'buddy_agency_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buddyId: uuid('buddy_id')
      .notNull()
      .references(() => buddies.id, { onDelete: 'cascade' }),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'restrict' }),
    memberNumber: text('member_number').notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('buddy_agency_memberships_buddy_agency_unique').on(
      table.buddyId,
      table.agencyId,
    ),
    index('buddy_agency_memberships_agency_id_index').on(table.agencyId),
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
    agencyId: uuid('agency_id').references(() => agencies.id, {
      onDelete: 'restrict',
    }),
    certificationNumber: text('certification_number'),
    certifiedAt: date('certified_at'),
    featuredOnCard: boolean('featured_on_card').notNull().default(false),
    instructorBuddyId: uuid('instructor_buddy_id').references(() => buddies.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order'),
    scan1Path: text('scan_1_path'),
    scan2Path: text('scan_2_path'),
    scan1StoragePath: text('scan_1_storage_path'),
    scan1ThumbnailStoragePath: text('scan_1_thumbnail_storage_path'),
    scan1MimeType: text('scan_1_mime_type'),
    scan1ByteSize: integer('scan_1_byte_size'),
    scan2StoragePath: text('scan_2_storage_path'),
    scan2ThumbnailStoragePath: text('scan_2_thumbnail_storage_path'),
    scan2MimeType: text('scan_2_mime_type'),
    scan2ByteSize: integer('scan_2_byte_size'),
    ...auditColumns,
  },
  (table) => [index('certifications_agency_id_index').on(table.agencyId)],
)

export const agencyMemberships = pgTable(
  'agency_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diverId: uuid('diver_id').references(() => divers.id, {
      onDelete: 'set null',
    }),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'restrict' }),
    memberNumber: text('member_number').notNull(),
    ...auditColumns,
  },
  (table) => [
    index('agency_memberships_diver_id_index').on(table.diverId),
    index('agency_memberships_agency_id_index').on(table.agencyId),
  ],
)

export const diveTypes = pgTable('dive_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order'),
  ...auditColumns,
})

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
    boatId: uuid('boat_id').references(() => boats.id, {
      onDelete: 'set null',
    }),
    diveTypeId: uuid('dive_type_id').references(() => diveTypes.id, {
      onDelete: 'set null',
    }),
    captureSource: diveCaptureSource('capture_source').notNull().default('manual'),
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
    equipmentWeightKg: numeric('equipment_weight_kg', { precision: 7, scale: 3 }),
    maximumPpo2: numeric('maximum_ppo2', { precision: 8, scale: 6 }),
    decompressionDive: boolean('decompression_dive').notNull().default(false),
    safetyStop: boolean('safety_stop').notNull().default(false),
    safetyStopSeconds: integer('safety_stop_seconds'),
    // Dive-table bookkeeping from paper logbooks: the repetitive-group letter
    // before and after the surface interval, the letter at the end of this
    // dive, and the residual nitrogen time the tables assigned to it.
    pressureGroupBeforeInterval: text('pressure_group_before_interval'),
    pressureGroupAfterInterval: text('pressure_group_after_interval'),
    pressureGroupEnd: text('pressure_group_end'),
    residualNitrogenSeconds: integer('residual_nitrogen_seconds'),
    visibility: text('visibility'),
    current: text('current'),
    waves: text('waves'),
    weather: text('weather'),
    waterType: integer('water_type'),
    entryType: integer('entry_type'),
    rating: integer('rating'),
    computer: text('computer'),
    suit: text('suit'),
    notes: text('notes'),
    ...auditColumns,
  },
  (table) => [
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
    // Segment 0 is the dive's own profile. Merging another dive in appends its
    // samples under the next index so the chart can break the line across the
    // surface interval instead of interpolating through it.
    segmentIndex: integer('segment_index').notNull().default(0),
    elapsedSeconds: integer('elapsed_seconds').notNull(),
    depthMeters: numeric('depth_meters', { precision: 7, scale: 2 }).notNull(),
    temperatureCelsius: numeric('temperature_celsius', { precision: 5, scale: 2 }),
    pressureBar: numeric('pressure_bar', { precision: 7, scale: 2 }),
    tank1PressureBar: numeric('tank_1_pressure_bar', { precision: 7, scale: 2 }),
    tank2PressureBar: numeric('tank_2_pressure_bar', { precision: 7, scale: 2 }),
    decoCeilingMeters: numeric('deco_ceiling_meters', { precision: 7, scale: 2 }),
    tankNumber: integer('tank_number'),
    ...auditColumns,
  },
  (table) => [
    index('dive_profile_samples_dive_sample_index').on(table.diveId, table.sampleIndex),
    index('dive_profile_samples_dive_elapsed_index').on(
      table.diveId,
      table.elapsedSeconds,
    ),
  ],
)

/**
 * One segment of a merged dive. A dive computer that splits a single dive into
 * several log entries leaves them to be recombined by hand; merging deletes the
 * source dives, so this records what went into the surviving one.
 */
export const diveMerges = pgTable(
  'dive_merges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetDiveId: uuid('target_dive_id')
      .notNull()
      .references(() => dives.id, { onDelete: 'cascade' }),
    segmentIndex: integer('segment_index').notNull(),
    offsetSeconds: integer('offset_seconds').notNull(),
    // The source dive row is gone by the time this is read, so no foreign key.
    sourceDiveId: uuid('source_dive_id').notNull(),
    sourceLabel: text('source_label').notNull(),
    mergedAt: timestamp('merged_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('dive_merges_target_dive_id_index').on(table.targetDiveId)],
)

export const diveBuddies = pgTable(
  'dive_buddies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diveId: uuid('dive_id')
      .notNull()
      .references(() => dives.id, { onDelete: 'cascade' }),
    buddyId: uuid('buddy_id')
      .notNull()
      .references(() => buddies.id, { onDelete: 'cascade' }),
    role: diveBuddyRole('role').notNull().default('buddy'),
  },
  (table) => [
    uniqueIndex('dive_buddies_dive_buddy_unique').on(table.diveId, table.buddyId),
  ],
)

export const diveEquipment = pgTable(
  'dive_equipment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diveId: uuid('dive_id')
      .notNull()
      .references(() => dives.id, { onDelete: 'cascade' }),
    equipmentId: uuid('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('dive_equipment_dive_equipment_unique').on(
      table.diveId,
      table.equipmentId,
    ),
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
    volumeLiters: numeric('volume_liters', { precision: 7, scale: 2 }),
    startPressureBar: numeric('start_pressure_bar', {
      precision: 7,
      scale: 2,
    }),
    endPressureBar: numeric('end_pressure_bar', { precision: 7, scale: 2 }),
    workingPressureBar: numeric('working_pressure_bar', {
      precision: 7,
      scale: 2,
    }),
    oxygenPercent: numeric('oxygen_percent', { precision: 5, scale: 2 }),
    heliumPercent: numeric('helium_percent', { precision: 5, scale: 2 }),
    breathingTimeSeconds: integer('breathing_time_seconds'),
    weightKg: numeric('weight_kg', { precision: 7, scale: 3 }),
    ...auditColumns,
  },
  (table) => [index('tanks_dive_id_index').on(table.diveId)],
)

export const pictureKind = pgEnum('picture_kind', ['photo', 'signature', 'profile'])

export const pictures = pgTable(
  'pictures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diveId: uuid('dive_id').references(() => dives.id, { onDelete: 'set null' }),
    siteId: uuid('site_id').references(() => diveSites.id, { onDelete: 'set null' }),
    buddyId: uuid('buddy_id').references(() => buddies.id, { onDelete: 'set null' }),
    equipmentId: uuid('equipment_id').references(() => equipment.id, {
      onDelete: 'set null',
    }),
    diverId: uuid('diver_id').references(() => divers.id, { onDelete: 'set null' }),
    kind: pictureKind('kind').notNull().default('photo'),
    path: text('path').notNull(),
    storagePath: text('storage_path'),
    thumbnailStoragePath: text('thumbnail_storage_path'),
    mimeType: text('mime_type'),
    byteSize: integer('byte_size'),
    description: text('description'),
    sortOrder: integer('sort_order'),
    ...auditColumns,
  },
  (table) => [
    index('pictures_dive_id_index').on(table.diveId),
    index('pictures_site_id_index').on(table.siteId),
  ],
)

export interface IntegrationCapabilities {
  fullImport: boolean
  incrementalImport: boolean
  export: boolean
}

export const integrations = pgTable('integrations', {
  key: text('key').primaryKey(),
  displayName: text('display_name').notNull(),
  capabilities: jsonb('capabilities').$type<IntegrationCapabilities>().notNull(),
  supportedEntities: jsonb('supported_entities').$type<string[]>().notNull(),
  ...auditColumns,
})

export const importRunMode = pgEnum('import_run_mode', ['full', 'incremental'])

export const importRunStatus = pgEnum('import_run_status', [
  'pending',
  'running',
  'succeeded',
  'partially_failed',
  'failed',
])

export const importRunTrigger = pgEnum('import_run_trigger', [
  'manual',
  'schedule',
  'cli',
])

export const importRuns = pgTable(
  'import_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    integrationKey: text('integration_key')
      .notNull()
      .references(() => integrations.key, { onDelete: 'restrict' }),
    mode: importRunMode('mode').notNull(),
    trigger: importRunTrigger('trigger').notNull().default('manual'),
    status: importRunStatus('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    recordsDiscovered: integer('records_discovered').notNull().default(0),
    recordsCreated: integer('records_created').notNull().default(0),
    recordsUpdated: integer('records_updated').notNull().default(0),
    recordsSkipped: integer('records_skipped').notNull().default(0),
    recordsFailed: integer('records_failed').notNull().default(0),
    sourceFingerprint: text('source_fingerprint'),
    diagnostics: jsonb('diagnostics').$type<Record<string, unknown>>(),
    error: text('error'),
  },
  (table) => [
    index('import_runs_started_at_index').on(table.startedAt),
    index('import_runs_integration_started_at_index').on(
      table.integrationKey,
      table.startedAt,
    ),
  ],
)

export const integrationState = pgTable('integration_state', {
  integrationKey: text('integration_key')
    .primaryKey()
    .references(() => integrations.key, { onDelete: 'cascade' }),
  state: jsonb('state').$type<Record<string, unknown>>().notNull().default({}),
  lastSuccessfulRunId: uuid('last_successful_run_id').references(() => importRuns.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * The Garmin Connect client requires two opaque OAuth token payloads. They stay
 * in the application database, which is server-only, so imports work from the
 * web process, the CLI, and scheduled jobs without a second service or volume.
 */
export const garminAccounts = pgTable('garmin_accounts', {
  id: text('id').primaryKey().default('instance'),
  oauth1Token: jsonb('oauth1_token').$type<Record<string, unknown>>(),
  oauth2Token: jsonb('oauth2_token').$type<Record<string, unknown>>(),
  tokensSavedAt: timestamp('tokens_saved_at', { withTimezone: true }),
  ...auditColumns,
})

export const externalRecords = pgTable(
  'external_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    integrationKey: text('integration_key')
      .notNull()
      .references(() => integrations.key, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    identityKey: text('identity_key').notNull(),
    externalId: text('external_id'),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull(),
    fileMetadata: jsonb('file_metadata').$type<Record<string, unknown>>(),
    contentHash: text('content_hash').notNull(),
    externalCreatedAt: timestamp('external_created_at', { withTimezone: true }),
    externalUpdatedAt: timestamp('external_updated_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    firstSeenRunId: uuid('first_seen_run_id').references(() => importRuns.id, {
      onDelete: 'set null',
    }),
    lastSeenRunId: uuid('last_seen_run_id').references(() => importRuns.id, {
      onDelete: 'set null',
    }),
    mapperVersion: integer('mapper_version').notNull().default(1),
    processingError: text('processing_error'),
  },
  (table) => [
    uniqueIndex('external_records_integration_entity_identity_unique').on(
      table.integrationKey,
      table.entityType,
      table.identityKey,
    ),
    index('external_records_external_id_index').on(
      table.integrationKey,
      table.entityType,
      table.externalId,
    ),
    index('external_records_last_seen_at_index').on(table.lastSeenAt),
  ],
)

export const externalRecordLinks = pgTable(
  'external_record_links',
  {
    externalRecordId: uuid('external_record_id')
      .notNull()
      .references(() => externalRecords.id, { onDelete: 'cascade' }),
    canonicalEntityType: text('canonical_entity_type').notNull(),
    canonicalEntityId: uuid('canonical_entity_id').notNull(),
    role: text('role').notNull().default('produced'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.externalRecordId,
        table.canonicalEntityType,
        table.canonicalEntityId,
      ],
    }),
    index('external_record_links_canonical_index').on(
      table.canonicalEntityType,
      table.canonicalEntityId,
    ),
  ],
)

export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ...auditColumns,
})

export const oauthAuthorizationCodes = pgTable(
  'oauth_authorization_codes',
  {
    codeHash: text('code_hash').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    redirectUri: text('redirect_uri').notNull(),
    codeChallenge: text('code_challenge').notNull(),
    codeChallengeMethod: text('code_challenge_method').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('oauth_authorization_codes_client_index').on(table.clientId)],
)

export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    accessTokenId: text('access_token_id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }).notNull(),
    refreshTokenHash: text('refresh_token_hash'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    originatingAuthorizationCodeHash: text('originating_authorization_code_hash'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_tokens_refresh_token_hash_unique').on(table.refreshTokenHash),
    index('oauth_tokens_client_index').on(table.clientId),
    index('oauth_tokens_authorization_code_index').on(
      table.originatingAuthorizationCodeHash,
    ),
  ],
)

export const mcpAuditEvents = pgTable(
  'mcp_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event: text('event').notNull(),
    outcome: text('outcome').notNull(),
    clientId: text('client_id'),
    toolName: text('tool_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('mcp_audit_events_created_at_index').on(table.createdAt)],
)

export const mcpSettings = pgTable('mcp_settings', {
  id: text('id').primaryKey().default('instance'),
  enabled: boolean('enabled').notNull().default(true),
  disabledTools: jsonb('disabled_tools').$type<string[]>().notNull().default([]),
  ...auditColumns,
})
