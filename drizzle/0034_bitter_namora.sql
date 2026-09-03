CREATE TYPE "public"."dive_buddy_role" AS ENUM('buddy', 'divemaster', 'instructor', 'guide');--> statement-breakpoint
ALTER TABLE "dive_buddies" ADD COLUMN "role" "dive_buddy_role" DEFAULT 'buddy' NOT NULL;--> statement-breakpoint
WITH "divemaster_names" AS (
	SELECT DISTINCT ON (
		lower(btrim(regexp_replace("divemaster", '[[:space:]]+', ' ', 'g')))
	)
		btrim(regexp_replace("divemaster", '[[:space:]]+', ' ', 'g')) AS "display_name",
		lower(btrim(regexp_replace("divemaster", '[[:space:]]+', ' ', 'g'))) AS "normalized_name"
	FROM "dives"
	WHERE nullif(btrim("divemaster"), '') IS NOT NULL
)
INSERT INTO "buddies" ("first_name")
SELECT "display_name"
FROM "divemaster_names"
WHERE NOT EXISTS (
	SELECT 1
	FROM "buddies"
	WHERE lower(
		btrim(
			regexp_replace(
				concat_ws(' ', "buddies"."first_name", "buddies"."last_name"),
				'[[:space:]]+',
				' ',
				'g'
			)
		)
	) = "divemaster_names"."normalized_name"
);--> statement-breakpoint
WITH "divemaster_matches" AS (
	SELECT
		"dives"."id" AS "dive_id",
		(
			SELECT "buddies"."id"
			FROM "buddies"
			WHERE lower(
				btrim(
					regexp_replace(
						concat_ws(' ', "buddies"."first_name", "buddies"."last_name"),
						'[[:space:]]+',
						' ',
						'g'
					)
				)
			) = lower(
				btrim(regexp_replace("dives"."divemaster", '[[:space:]]+', ' ', 'g'))
			)
			ORDER BY "buddies"."created_at", "buddies"."id"
			LIMIT 1
		) AS "buddy_id"
	FROM "dives"
	WHERE nullif(btrim("dives"."divemaster"), '') IS NOT NULL
)
INSERT INTO "dive_buddies" ("dive_id", "buddy_id", "role")
SELECT "dive_id", "buddy_id", 'divemaster'
FROM "divemaster_matches"
WHERE "buddy_id" IS NOT NULL
ON CONFLICT ("dive_id", "buddy_id") DO UPDATE SET "role" = 'divemaster';--> statement-breakpoint
ALTER TABLE "dives" DROP COLUMN "divemaster";
