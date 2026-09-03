WITH "instructor_names" AS (
	SELECT DISTINCT ON (
		lower(btrim(regexp_replace("instructor_name", '[[:space:]]+', ' ', 'g')))
	)
		btrim(regexp_replace("instructor_name", '[[:space:]]+', ' ', 'g')) AS "display_name",
		lower(btrim(regexp_replace("instructor_name", '[[:space:]]+', ' ', 'g'))) AS "normalized_name"
	FROM "certifications"
	WHERE nullif(btrim("instructor_name"), '') IS NOT NULL
	ORDER BY
		lower(btrim(regexp_replace("instructor_name", '[[:space:]]+', ' ', 'g'))),
		"instructor_name"
)
INSERT INTO "buddies" ("first_name")
SELECT "display_name"
FROM "instructor_names"
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
	) = "instructor_names"."normalized_name"
);--> statement-breakpoint
WITH "instructor_matches" AS (
	SELECT
		"certifications"."id" AS "certification_id",
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
						"certifications"."instructor_name",
						'[[:space:]]+',
						' ',
						'g'
					)
				)
			)
			ORDER BY "buddies"."created_at", "buddies"."id"
			LIMIT 1
		) AS "buddy_id"
	FROM "certifications"
	WHERE nullif(btrim("certifications"."instructor_name"), '') IS NOT NULL
)
UPDATE "certifications"
SET "instructor_buddy_id" = "instructor_matches"."buddy_id"
FROM "instructor_matches"
WHERE
	"certifications"."id" = "instructor_matches"."certification_id"
	AND "instructor_matches"."buddy_id" IS NOT NULL;
