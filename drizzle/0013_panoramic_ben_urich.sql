DROP INDEX "buddies_source_external_id_unique";--> statement-breakpoint
DROP INDEX "certifications_source_external_id_unique";--> statement-breakpoint
DROP INDEX "dive_profile_samples_dive_source_index_unique";--> statement-breakpoint
DROP INDEX "dive_sites_source_external_id_unique";--> statement-breakpoint
DROP INDEX "dive_types_source_external_id_unique";--> statement-breakpoint
DROP INDEX "divers_source_external_id_unique";--> statement-breakpoint
DROP INDEX "dives_source_external_id_unique";--> statement-breakpoint
DROP INDEX "equipment_source_external_id_unique";--> statement-breakpoint
DROP INDEX "pictures_source_external_id_unique";--> statement-breakpoint
DROP INDEX "shops_source_external_id_unique";--> statement-breakpoint
DROP INDEX "tanks_source_external_id_unique";--> statement-breakpoint
ALTER TABLE "dive_buddies" DROP CONSTRAINT "dive_buddies_dive_id_buddy_id_source_key_pk";--> statement-breakpoint
ALTER TABLE "dive_equipment" DROP CONSTRAINT "dive_equipment_dive_id_equipment_id_source_key_pk";--> statement-breakpoint
ALTER TABLE "dive_buddies" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "dive_equipment" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT
    db.id,
    db.dive_id,
    db.source_key,
    first_value(db.id) OVER (
      PARTITION BY db.dive_id, db.buddy_id
      ORDER BY CASE WHEN db.source_key = 'manual' THEN 0 ELSE 1 END, db.source_key, db.id
    ) AS keep_id
  FROM dive_buddies db
)
INSERT INTO external_record_links (
  external_record_id,
  canonical_entity_type,
  canonical_entity_id,
  role
)
SELECT er.id, 'dive_buddy', ranked.keep_id, 'association'
FROM ranked
JOIN dives d ON d.id = ranked.dive_id
JOIN external_records er
  ON er.integration_key = ranked.source_key
 AND er.entity_type = 'dive'
 AND er.identity_key = d.external_id
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH ranked AS (
  SELECT
    de.id,
    de.dive_id,
    de.source_key,
    first_value(de.id) OVER (
      PARTITION BY de.dive_id, de.equipment_id
      ORDER BY CASE WHEN de.source_key = 'manual' THEN 0 ELSE 1 END, de.source_key, de.id
    ) AS keep_id
  FROM dive_equipment de
)
INSERT INTO external_record_links (
  external_record_id,
  canonical_entity_type,
  canonical_entity_id,
  role
)
SELECT er.id, 'dive_equipment', ranked.keep_id, 'association'
FROM ranked
JOIN dives d ON d.id = ranked.dive_id
JOIN external_records er
  ON er.integration_key = ranked.source_key
 AND er.entity_type = 'dive'
 AND er.identity_key = d.external_id
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO external_record_links (
  external_record_id,
  canonical_entity_type,
  canonical_entity_id,
  role
)
SELECT er.id, 'profile_sample', sample.id, 'derived'
FROM dive_profile_samples sample
JOIN dives d ON d.id = sample.dive_id
JOIN external_records er
  ON er.integration_key = sample.source_key
 AND er.entity_type = 'dive'
 AND er.identity_key = d.external_id
ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM external_records
WHERE integration_key = 'divemate'
  AND entity_type = 'profile_sample';--> statement-breakpoint
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY dive_id, buddy_id
    ORDER BY CASE WHEN source_key = 'manual' THEN 0 ELSE 1 END, source_key, id
  ) AS position
  FROM dive_buddies
)
DELETE FROM dive_buddies
WHERE id IN (SELECT id FROM ranked WHERE position > 1);--> statement-breakpoint
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY dive_id, equipment_id
    ORDER BY CASE WHEN source_key = 'manual' THEN 0 ELSE 1 END, source_key, id
  ) AS position
  FROM dive_equipment
)
DELETE FROM dive_equipment
WHERE id IN (SELECT id FROM ranked WHERE position > 1);--> statement-breakpoint
WITH ordered AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY dive_id
      ORDER BY sample_index, elapsed_seconds, id
    ) - 1 AS normalized_index
  FROM dive_profile_samples
)
UPDATE dive_profile_samples sample
SET sample_index = ordered.normalized_index
FROM ordered
WHERE sample.id = ordered.id;--> statement-breakpoint
CREATE UNIQUE INDEX "dive_buddies_dive_buddy_unique" ON "dive_buddies" USING btree ("dive_id","buddy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dive_equipment_dive_equipment_unique" ON "dive_equipment" USING btree ("dive_id","equipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dive_profile_samples_dive_sample_index_unique" ON "dive_profile_samples" USING btree ("dive_id","sample_index");--> statement-breakpoint
ALTER TABLE "buddies" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "buddies" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "buddies" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "buddies" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "buddies" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "certifications" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "certifications" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "certifications" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "certifications" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "certifications" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "dive_buddies" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "dive_equipment" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "dive_profile_samples" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "dive_profile_samples" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "dive_profile_samples" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "dive_profile_samples" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "dive_profile_samples" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "dive_sites" DROP COLUMN "source_latitude";--> statement-breakpoint
ALTER TABLE "dive_sites" DROP COLUMN "source_longitude";--> statement-breakpoint
ALTER TABLE "dive_sites" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "dive_sites" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "dive_sites" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "dive_sites" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "dive_sites" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "dive_types" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "dive_types" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "dive_types" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "dive_types" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "dive_types" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "divers" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "divers" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "divers" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "divers" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "divers" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "dives" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "dives" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "dives" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "dives" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "dives" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "equipment_type_code";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "source_value_1";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "source_value_2";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "source_value_3";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "pictures" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "pictures" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "pictures" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "pictures" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "pictures" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "source_payload";--> statement-breakpoint
ALTER TABLE "tanks" DROP COLUMN "tank_type";--> statement-breakpoint
ALTER TABLE "tanks" DROP COLUMN "supply_type_code";--> statement-breakpoint
ALTER TABLE "tanks" DROP COLUMN "dive_phase_code";--> statement-breakpoint
ALTER TABLE "tanks" DROP COLUMN "source_key";--> statement-breakpoint
ALTER TABLE "tanks" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "tanks" DROP COLUMN "external_uuid";--> statement-breakpoint
ALTER TABLE "tanks" DROP COLUMN "source_updated_at";--> statement-breakpoint
ALTER TABLE "tanks" DROP COLUMN "source_payload";
