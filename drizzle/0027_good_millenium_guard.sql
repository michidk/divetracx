CREATE TABLE "buddy_agency_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buddy_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"member_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buddy_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buddy_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buddy_agency_memberships" ADD CONSTRAINT "buddy_agency_memberships_buddy_id_buddies_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."buddies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_agency_memberships" ADD CONSTRAINT "buddy_agency_memberships_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_certifications" ADD CONSTRAINT "buddy_certifications_buddy_id_buddies_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."buddies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_certifications" ADD CONSTRAINT "buddy_certifications_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "buddy_agency_memberships" (
	"buddy_id",
	"agency_id",
	"member_number",
	"created_at",
	"updated_at"
)
SELECT DISTINCT ON ("instructor_buddy_id", "agency_id")
	"instructor_buddy_id",
	"agency_id",
	btrim("instructor_number"),
	"created_at",
	"updated_at"
FROM "certifications"
WHERE
	"instructor_buddy_id" IS NOT NULL
	AND "agency_id" IS NOT NULL
	AND nullif(btrim("instructor_number"), '') IS NOT NULL
ORDER BY "instructor_buddy_id", "agency_id", "updated_at" DESC, "id";--> statement-breakpoint
CREATE UNIQUE INDEX "buddy_agency_memberships_buddy_agency_unique" ON "buddy_agency_memberships" USING btree ("buddy_id","agency_id");--> statement-breakpoint
CREATE INDEX "buddy_agency_memberships_agency_id_index" ON "buddy_agency_memberships" USING btree ("agency_id");--> statement-breakpoint
CREATE INDEX "buddy_certifications_buddy_id_index" ON "buddy_certifications" USING btree ("buddy_id");--> statement-breakpoint
CREATE INDEX "buddy_certifications_agency_id_index" ON "buddy_certifications" USING btree ("agency_id");--> statement-breakpoint
UPDATE "buddies"
SET "notes" = concat_ws(
	E'\n\n',
	nullif(btrim("notes"), ''),
	CASE
		WHEN nullif(btrim("certifications"), '') IS NOT NULL
		THEN E'Legacy certifications:\n' || btrim("certifications")
	END,
	CASE
		WHEN nullif(btrim("agencies"), '') IS NOT NULL
		THEN E'Legacy agencies:\n' || btrim("agencies")
	END
)
WHERE
	nullif(btrim("certifications"), '') IS NOT NULL
	OR nullif(btrim("agencies"), '') IS NOT NULL;--> statement-breakpoint
ALTER TABLE "buddies" DROP COLUMN "certifications";--> statement-breakpoint
ALTER TABLE "buddies" DROP COLUMN "agencies";--> statement-breakpoint
ALTER TABLE "certifications" DROP COLUMN "instructor_number";
