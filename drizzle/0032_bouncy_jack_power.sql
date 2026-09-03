ALTER TABLE "certifications" ADD COLUMN "featured_on_card" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
WITH "ranked_certifications" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "diver_id"
			ORDER BY "certified_at" DESC NULLS LAST, "id"
		) AS "card_rank"
	FROM "certifications"
)
UPDATE "certifications"
SET "featured_on_card" = true
FROM "ranked_certifications"
WHERE "certifications"."id" = "ranked_certifications"."id"
	AND "ranked_certifications"."card_rank" <= 8;
