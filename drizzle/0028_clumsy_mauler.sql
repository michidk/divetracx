WITH "buddy_names" AS (
	SELECT DISTINCT ON (
		lower(btrim(regexp_replace("legacy_buddy_text", '[[:space:]]+', ' ', 'g')))
	)
		btrim(regexp_replace("legacy_buddy_text", '[[:space:]]+', ' ', 'g')) AS "display_name",
		lower(btrim(regexp_replace("legacy_buddy_text", '[[:space:]]+', ' ', 'g'))) AS "normalized_name"
	FROM "dives"
	WHERE nullif(btrim("legacy_buddy_text"), '') IS NOT NULL
	ORDER BY
		lower(btrim(regexp_replace("legacy_buddy_text", '[[:space:]]+', ' ', 'g'))),
		"legacy_buddy_text"
)
INSERT INTO "buddies" ("first_name")
SELECT "display_name"
FROM "buddy_names"
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
	) = "buddy_names"."normalized_name"
);--> statement-breakpoint
WITH "buddy_matches" AS (
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
				btrim(
					regexp_replace(
						"dives"."legacy_buddy_text",
						'[[:space:]]+',
						' ',
						'g'
					)
				)
			)
			ORDER BY "buddies"."created_at", "buddies"."id"
			LIMIT 1
		) AS "buddy_id"
	FROM "dives"
	WHERE nullif(btrim("dives"."legacy_buddy_text"), '') IS NOT NULL
)
INSERT INTO "dive_buddies" ("dive_id", "buddy_id")
SELECT "dive_id", "buddy_id"
FROM "buddy_matches"
WHERE "buddy_id" IS NOT NULL
ON CONFLICT ("dive_id", "buddy_id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "dives" DROP COLUMN "legacy_buddy_text";
