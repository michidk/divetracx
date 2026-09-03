CREATE TABLE "equipment_set_items" (
	"equipment_set_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "equipment_set_items_equipment_set_id_equipment_id_pk" PRIMARY KEY("equipment_set_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "equipment_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"inactive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment_set_items" ADD CONSTRAINT "equipment_set_items_equipment_set_id_equipment_sets_id_fk" FOREIGN KEY ("equipment_set_id") REFERENCES "public"."equipment_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_set_items" ADD CONSTRAINT "equipment_set_items_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_set_items_equipment_index" ON "equipment_set_items" USING btree ("equipment_id");
--> statement-breakpoint
INSERT INTO "equipment_sets" ("id", "name", "notes", "inactive", "created_at", "updated_at")
SELECT
	"equipment"."id",
	"equipment"."name",
	"equipment"."notes",
	"equipment"."inactive",
	"equipment"."created_at",
	"equipment"."updated_at"
FROM "equipment"
INNER JOIN "external_record_links"
	ON "external_record_links"."canonical_entity_type" = 'equipment'
	AND "external_record_links"."canonical_entity_id" = "equipment"."id"
INNER JOIN "external_records"
	ON "external_records"."id" = "external_record_links"."external_record_id"
WHERE "external_records"."integration_key" = 'divemate'
	AND "external_records"."entity_type" = 'equipment'
	AND (
		"external_records"."raw_payload" ->> 'Category' = '---SET'
		OR "external_records"."raw_payload" ->> 'TypeID' = '9'
	)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "equipment_set_items" ("equipment_set_id", "equipment_id", "sort_order")
SELECT
	"set_link"."canonical_entity_id",
	"member_link"."canonical_entity_id",
	"member"."ordinality"::integer - 1
FROM "external_records" AS "set_record"
INNER JOIN "external_record_links" AS "set_link"
	ON "set_link"."external_record_id" = "set_record"."id"
	AND "set_link"."canonical_entity_type" = 'equipment'
CROSS JOIN LATERAL regexp_split_to_table(
	coalesce("set_record"."raw_payload" ->> 'Info', ''),
	'\s*,\s*'
) WITH ORDINALITY AS "member"("external_id", "ordinality")
INNER JOIN "external_records" AS "member_record"
	ON "member_record"."integration_key" = 'divemate'
	AND "member_record"."entity_type" = 'equipment'
	AND "member_record"."external_id" = "member"."external_id"
INNER JOIN "external_record_links" AS "member_link"
	ON "member_link"."external_record_id" = "member_record"."id"
	AND "member_link"."canonical_entity_type" = 'equipment'
WHERE "set_record"."integration_key" = 'divemate'
	AND "set_record"."entity_type" = 'equipment'
	AND (
		"set_record"."raw_payload" ->> 'Category' = '---SET'
		OR "set_record"."raw_payload" ->> 'TypeID' = '9'
	)
	AND "member"."external_id" <> ''
ON CONFLICT ("equipment_set_id", "equipment_id") DO NOTHING;
--> statement-breakpoint
UPDATE "external_record_links"
SET "canonical_entity_type" = 'equipment_set'
FROM "external_records"
WHERE "external_records"."id" = "external_record_links"."external_record_id"
	AND "external_records"."integration_key" = 'divemate'
	AND "external_records"."entity_type" = 'equipment'
	AND "external_record_links"."canonical_entity_type" = 'equipment'
	AND (
		"external_records"."raw_payload" ->> 'Category' = '---SET'
		OR "external_records"."raw_payload" ->> 'TypeID' = '9'
	);
--> statement-breakpoint
DELETE FROM "equipment"
USING "equipment_sets"
WHERE "equipment"."id" = "equipment_sets"."id";
--> statement-breakpoint
UPDATE "external_records"
SET "entity_type" = 'equipment_set'
WHERE "integration_key" = 'divemate'
	AND "entity_type" = 'equipment'
	AND (
		"raw_payload" ->> 'Category' = '---SET'
		OR "raw_payload" ->> 'TypeID' = '9'
	);
