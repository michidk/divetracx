CREATE TABLE "boats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "boat_id" uuid;--> statement-breakpoint
INSERT INTO "boats" ("name")
SELECT DISTINCT ON (lower(trim("boat"))) trim("boat")
FROM "dives"
WHERE nullif(trim("boat"), '') IS NOT NULL
ORDER BY lower(trim("boat")), "created_at";--> statement-breakpoint
UPDATE "dives"
SET "boat_id" = "boats"."id"
FROM "boats"
WHERE lower(trim("dives"."boat")) = lower("boats"."name");--> statement-breakpoint
ALTER TABLE "dives" ADD CONSTRAINT "dives_boat_id_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "public"."boats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dives" DROP COLUMN "boat";
