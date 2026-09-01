CREATE TYPE "public"."import_run_mode" AS ENUM('full', 'incremental');--> statement-breakpoint
CREATE TYPE "public"."import_run_status" AS ENUM('pending', 'running', 'succeeded', 'partially_failed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_run_trigger" AS ENUM('manual', 'schedule', 'cli');--> statement-breakpoint
CREATE TABLE "external_record_links" (
	"external_record_id" uuid NOT NULL,
	"canonical_entity_type" text NOT NULL,
	"canonical_entity_id" uuid NOT NULL,
	"role" text DEFAULT 'produced' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_record_links_external_record_id_canonical_entity_type_canonical_entity_id_pk" PRIMARY KEY("external_record_id","canonical_entity_type","canonical_entity_id")
);
--> statement-breakpoint
CREATE TABLE "external_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"identity_key" text NOT NULL,
	"external_id" text,
	"raw_payload" jsonb NOT NULL,
	"file_metadata" jsonb,
	"content_hash" text NOT NULL,
	"external_created_at" timestamp with time zone,
	"external_updated_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"first_seen_run_id" uuid,
	"last_seen_run_id" uuid,
	"mapper_version" integer DEFAULT 1 NOT NULL,
	"processing_error" text
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_key" text NOT NULL,
	"mode" "import_run_mode" NOT NULL,
	"trigger" "import_run_trigger" DEFAULT 'manual' NOT NULL,
	"status" "import_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"records_discovered" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"source_fingerprint" text,
	"diagnostics" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "integration_state" (
	"integration_key" text PRIMARY KEY NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_successful_run_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"key" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"capabilities" jsonb NOT NULL,
	"supported_entities" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_record_links" ADD CONSTRAINT "external_record_links_external_record_id_external_records_id_fk" FOREIGN KEY ("external_record_id") REFERENCES "public"."external_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_records" ADD CONSTRAINT "external_records_integration_key_integrations_key_fk" FOREIGN KEY ("integration_key") REFERENCES "public"."integrations"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_records" ADD CONSTRAINT "external_records_first_seen_run_id_import_runs_id_fk" FOREIGN KEY ("first_seen_run_id") REFERENCES "public"."import_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_records" ADD CONSTRAINT "external_records_last_seen_run_id_import_runs_id_fk" FOREIGN KEY ("last_seen_run_id") REFERENCES "public"."import_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_integration_key_integrations_key_fk" FOREIGN KEY ("integration_key") REFERENCES "public"."integrations"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_state" ADD CONSTRAINT "integration_state_integration_key_integrations_key_fk" FOREIGN KEY ("integration_key") REFERENCES "public"."integrations"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_state" ADD CONSTRAINT "integration_state_last_successful_run_id_import_runs_id_fk" FOREIGN KEY ("last_successful_run_id") REFERENCES "public"."import_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_record_links_canonical_index" ON "external_record_links" USING btree ("canonical_entity_type","canonical_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_records_integration_entity_identity_unique" ON "external_records" USING btree ("integration_key","entity_type","identity_key");--> statement-breakpoint
CREATE INDEX "external_records_external_id_index" ON "external_records" USING btree ("integration_key","entity_type","external_id");--> statement-breakpoint
CREATE INDEX "external_records_last_seen_at_index" ON "external_records" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "import_runs_started_at_index" ON "import_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "import_runs_integration_started_at_index" ON "import_runs" USING btree ("integration_key","started_at");--> statement-breakpoint
INSERT INTO "integrations" (
	"key",
	"display_name",
	"capabilities",
	"supported_entities"
)
VALUES
	(
		'divemate',
		'DiveMate',
		'{"fullImport":true,"incrementalImport":true,"export":true}'::jsonb,
		'["divers","dive_sites","buddies","equipment","certifications","shops","dive_types","dives","profile_samples","tanks","pictures"]'::jsonb
	),
	(
		'garmin',
		'Garmin',
		'{"fullImport":true,"incrementalImport":true,"export":false}'::jsonb,
		'["dives","dive_sites","profile_samples","tanks"]'::jsonb
	)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "integrations" (
	"key",
	"display_name",
	"capabilities",
	"supported_entities"
)
SELECT
	"source_key",
	initcap(replace("source_key", '_', ' ')),
	'{"fullImport":false,"incrementalImport":false,"export":false}'::jsonb,
	'[]'::jsonb
FROM (
	SELECT "source_key" FROM "divers"
	UNION SELECT "source_key" FROM "dive_sites"
	UNION SELECT "source_key" FROM "buddies"
	UNION SELECT "source_key" FROM "shops"
	UNION SELECT "source_key" FROM "equipment"
	UNION SELECT "source_key" FROM "certifications"
	UNION SELECT "source_key" FROM "dive_types"
	UNION SELECT "source_key" FROM "dives"
	UNION SELECT "source_key" FROM "dive_profile_samples"
	UNION SELECT "source_key" FROM "tanks"
	UNION SELECT "source_key" FROM "pictures"
	UNION SELECT "source_key" FROM "sync_runs"
) AS "legacy_sources"
WHERE "source_key" <> 'manual'
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "import_runs" (
	"id",
	"integration_key",
	"mode",
	"trigger",
	"status",
	"started_at",
	"finished_at",
	"records_discovered",
	"source_fingerprint",
	"diagnostics",
	"error"
)
SELECT
	"id",
	"source_key",
	'incremental'::"import_run_mode",
	"trigger"::text::"import_run_trigger",
	"status"::text::"import_run_status",
	"started_at",
	"finished_at",
	COALESCE((
		SELECT sum("value"::integer)
		FROM jsonb_each_text(COALESCE("sync_runs"."counts", '{}'::jsonb))
		WHERE "value" ~ '^[0-9]+$'
	), 0),
	"source_fingerprint",
	jsonb_strip_nulls(jsonb_build_object(
		'migratedFromSyncRun', true,
		'legacyCounts', "counts",
		'sourceDatabaseVersion', "source_database_version",
		'sourceDatabaseProgram', "source_database_program",
		'sourceDatabaseUuid', "source_database_uuid",
		'sourceDatabaseUpdatedAt', "source_database_updated_at"
	)),
	"error"
FROM "sync_runs"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "integration_state" (
	"integration_key",
	"state",
	"last_successful_run_id",
	"updated_at"
)
SELECT
	"integrations"."key",
	'{}'::jsonb,
	(
		SELECT "id"
		FROM "import_runs"
		WHERE "integration_key" = "integrations"."key"
			AND "status" = 'succeeded'
		ORDER BY "started_at" DESC
		LIMIT 1
	),
	COALESCE((
		SELECT "finished_at"
		FROM "import_runs"
		WHERE "integration_key" = "integrations"."key"
			AND "status" = 'succeeded'
		ORDER BY "started_at" DESC
		LIMIT 1
	), now())
FROM "integrations"
ON CONFLICT ("integration_key") DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'diver', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "divers"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'diver', "divers"."id"
FROM "inserted"
JOIN "divers" ON "divers"."source_key" = "inserted"."integration_key"
	AND "divers"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'dive_site', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "dive_sites"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'dive_site', "dive_sites"."id"
FROM "inserted"
JOIN "dive_sites" ON "dive_sites"."source_key" = "inserted"."integration_key"
	AND "dive_sites"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'buddy', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "buddies"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'buddy', "buddies"."id"
FROM "inserted"
JOIN "buddies" ON "buddies"."source_key" = "inserted"."integration_key"
	AND "buddies"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'shop', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "shops"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'shop', "shops"."id"
FROM "inserted"
JOIN "shops" ON "shops"."source_key" = "inserted"."integration_key"
	AND "shops"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'equipment', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "equipment"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'equipment', "equipment"."id"
FROM "inserted"
JOIN "equipment" ON "equipment"."source_key" = "inserted"."integration_key"
	AND "equipment"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'certification', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "certifications"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'certification', "certifications"."id"
FROM "inserted"
JOIN "certifications" ON "certifications"."source_key" = "inserted"."integration_key"
	AND "certifications"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'dive_type', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "dive_types"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'dive_type', "dive_types"."id"
FROM "inserted"
JOIN "dive_types" ON "dive_types"."source_key" = "inserted"."integration_key"
	AND "dive_types"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'dive', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "dives"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'dive', "dives"."id"
FROM "inserted"
JOIN "dives" ON "dives"."source_key" = "inserted"."integration_key"
	AND "dives"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'profile_sample', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "dive_profile_samples"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'profile_sample', "dive_profile_samples"."id"
FROM "inserted"
JOIN "dive_profile_samples" ON "dive_profile_samples"."source_key" = "inserted"."integration_key"
	AND "dive_profile_samples"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'tank', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "tanks"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'tank', "tanks"."id"
FROM "inserted"
JOIN "tanks" ON "tanks"."source_key" = "inserted"."integration_key"
	AND "tanks"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH "inserted" AS (
	INSERT INTO "external_records" (
		"integration_key", "entity_type", "identity_key", "external_id",
		"raw_payload", "content_hash", "first_seen_at", "last_seen_at",
		"processed_at", "mapper_version"
	)
	SELECT
		"source_key", 'picture', "external_id", "external_id",
		COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)),
		'legacy-md5:' || md5((COALESCE("source_payload", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'_legacyExternalUuid', "external_uuid",
			'_legacySourceUpdatedAt', "source_updated_at"
		)))::text),
		"created_at", "updated_at", "updated_at", 0
	FROM "pictures"
	WHERE "source_key" <> 'manual' AND "external_id" IS NOT NULL
	ON CONFLICT ("integration_key", "entity_type", "identity_key") DO NOTHING
	RETURNING "id", "integration_key", "identity_key"
)
INSERT INTO "external_record_links" (
	"external_record_id", "canonical_entity_type", "canonical_entity_id"
)
SELECT "inserted"."id", 'picture', "pictures"."id"
FROM "inserted"
JOIN "pictures" ON "pictures"."source_key" = "inserted"."integration_key"
	AND "pictures"."external_id" = "inserted"."identity_key"
ON CONFLICT DO NOTHING;
