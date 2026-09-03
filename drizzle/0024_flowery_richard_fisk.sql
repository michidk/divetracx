CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"full_name" text,
	"normalized_name" text NOT NULL,
	"logo_src" text,
	"dark_logo" boolean DEFAULT false NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agencies_code_unique" ON "agencies" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX "agencies_normalized_name_unique" ON "agencies" USING btree ("normalized_name");
--> statement-breakpoint
INSERT INTO "agencies" ("id", "code", "name", "full_name", "normalized_name", "logo_src", "dark_logo", "built_in") VALUES
	('00000000-0000-4000-8000-000000000101', 'padi', 'PADI', 'Professional Association of Diving Instructors', 'padi', 'https://depthlog.net/assets/agencies/padi_128x128.jpeg', false, true),
	('00000000-0000-4000-8000-000000000102', 'ssi', 'SSI', 'Scuba Schools International', 'ssi', 'https://depthlog.net/assets/agencies/ssi_128x128.jpeg', false, true),
	('00000000-0000-4000-8000-000000000103', 'naui', 'NAUI', 'National Association of Underwater Instructors', 'naui', 'https://depthlog.net/assets/agencies/naui_128x128.jpeg', false, true),
	('00000000-0000-4000-8000-000000000104', 'cmas', 'CMAS', 'Confédération Mondiale des Activités Subaquatiques', 'cmas', 'https://depthlog.net/assets/agencies/cmas_128x128.jpeg', false, true),
	('00000000-0000-4000-8000-000000000105', 'bsac', 'BSAC', 'British Sub-Aqua Club', 'bsac', 'https://www.bsac.com/themes/bsac/gfx/logos/bsac-logo.png', false, true),
	('00000000-0000-4000-8000-000000000106', 'fipsas', 'FIPSAS', 'Federazione Italiana Pesca Sportiva e Attività Subacquee', 'fipsas', 'https://fipsas.it/wp-content/uploads/2025/10/Logo-FIPSAS.png', false, true),
	('00000000-0000-4000-8000-000000000107', 'sdi', 'SDI', 'Scuba Diving International', 'sdi', 'https://www.scuba.com/blog/wp-content/uploads/2018/11/SDI.jpg', false, true),
	('00000000-0000-4000-8000-000000000108', 'tdi', 'TDI', 'Technical Diving International', 'tdi', 'https://www.nicepng.com/png/full/38-387319_tdi-technical-diving-international-logo-technical-diving-international.png', false, true),
	('00000000-0000-4000-8000-000000000109', 'iantd', 'IANTD', 'International Association of Nitrox and Technical Divers', 'iantd', 'https://iantd.com/wp-content/uploads/2026/08/cropped-logo_trans-300x237.png', true, true);
--> statement-breakpoint
INSERT INTO "agencies" ("name", "normalized_name")
SELECT min(source."name"), source."normalized_name"
FROM (
	SELECT btrim("custom_agency_name") AS "name", lower(btrim("custom_agency_name")) AS "normalized_name"
	FROM "agency_memberships"
	WHERE nullif(btrim("custom_agency_name"), '') IS NOT NULL
	UNION ALL
	SELECT btrim("custom_agency_name") AS "name", lower(btrim("custom_agency_name")) AS "normalized_name"
	FROM "certifications"
	WHERE nullif(btrim("custom_agency_name"), '') IS NOT NULL
) source
WHERE NOT EXISTS (
	SELECT 1 FROM "agencies" built_in
	WHERE built_in."normalized_name" = source."normalized_name"
		OR lower(btrim(built_in."full_name")) = source."normalized_name"
)
GROUP BY source."normalized_name"
ON CONFLICT ("normalized_name") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD COLUMN "agency_id" uuid;
--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "agency_id" uuid;
--> statement-breakpoint
UPDATE "agency_memberships" membership
SET "agency_id" = COALESCE(
	(SELECT "id" FROM "agencies" WHERE "code" = membership."agency_code" LIMIT 1),
	(SELECT "id" FROM "agencies" WHERE "normalized_name" = lower(btrim(membership."custom_agency_name")) OR lower(btrim("full_name")) = lower(btrim(membership."custom_agency_name")) LIMIT 1)
);
--> statement-breakpoint
INSERT INTO "agencies" ("name", "normalized_name")
SELECT 'Custom agency', 'custom agency'
WHERE EXISTS (SELECT 1 FROM "agency_memberships" WHERE "agency_id" IS NULL)
ON CONFLICT ("normalized_name") DO NOTHING;
--> statement-breakpoint
UPDATE "agency_memberships"
SET "agency_id" = (SELECT "id" FROM "agencies" WHERE "normalized_name" = 'custom agency')
WHERE "agency_id" IS NULL;
--> statement-breakpoint
UPDATE "certifications" certification
SET "agency_id" = COALESCE(
	(SELECT "id" FROM "agencies" WHERE "code" = certification."agency_code" LIMIT 1),
	(SELECT "id" FROM "agencies" WHERE "normalized_name" = lower(btrim(certification."custom_agency_name")) OR lower(btrim("full_name")) = lower(btrim(certification."custom_agency_name")) LIMIT 1)
);
--> statement-breakpoint
ALTER TABLE "agency_memberships" ALTER COLUMN "agency_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agency_memberships_agency_id_index" ON "agency_memberships" USING btree ("agency_id");
--> statement-breakpoint
CREATE INDEX "certifications_agency_id_index" ON "certifications" USING btree ("agency_id");
--> statement-breakpoint
ALTER TABLE "agency_memberships" DROP COLUMN "agency_code";
--> statement-breakpoint
ALTER TABLE "agency_memberships" DROP COLUMN "custom_agency_name";
--> statement-breakpoint
ALTER TABLE "certifications" DROP COLUMN "agency_code";
--> statement-breakpoint
ALTER TABLE "certifications" DROP COLUMN "custom_agency_name";
