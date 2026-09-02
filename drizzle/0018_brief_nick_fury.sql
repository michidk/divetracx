CREATE TABLE "agency_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diver_id" uuid,
	"agency_code" text NOT NULL,
	"custom_agency_name" text,
	"member_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "insurance_tariff" text;--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "insurance_number" text;--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "insurance_hotline" text;--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_diver_id_divers_id_fk" FOREIGN KEY ("diver_id") REFERENCES "public"."divers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_memberships_diver_id_index" ON "agency_memberships" USING btree ("diver_id");