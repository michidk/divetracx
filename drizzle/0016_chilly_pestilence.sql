CREATE TYPE "public"."dive_capture_source" AS ENUM('manual', 'computer');--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "capture_source" "dive_capture_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
UPDATE "dives" AS "d"
SET "capture_source" = 'computer'
FROM "external_record_links" AS "l"
INNER JOIN "external_records" AS "r" ON "r"."id" = "l"."external_record_id"
WHERE "l"."canonical_entity_type" = 'dive'
  AND "l"."canonical_entity_id" = "d"."id"
  AND "r"."integration_key" IN ('divemate', 'garmin')
  AND (
    "r"."integration_key" = 'garmin'
    OR "r"."raw_payload"->>'Status' = '1'
  );
