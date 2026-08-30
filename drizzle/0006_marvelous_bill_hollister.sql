CREATE TABLE "pictures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dive_id" uuid,
	"site_id" uuid,
	"buddy_id" uuid,
	"equipment_id" uuid,
	"diver_id" uuid,
	"path" text NOT NULL,
	"description" text,
	"sort_order" integer,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buddies" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "buddies" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "buddies" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "scan_1_path" text;--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "scan_2_path" text;--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "divers" ADD COLUMN "emergency_email" text;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "diver_id" uuid;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "information" text;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "purchase_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "purchase_shop" text;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "equipment_type_code" integer;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "source_value_1" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "source_value_2" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "source_value_3" integer;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "source_database_version" text;--> statement-breakpoint
ALTER TABLE "tanks" ADD COLUMN "working_pressure_bar" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "tanks" ADD COLUMN "supply_type_code" integer;--> statement-breakpoint
ALTER TABLE "tanks" ADD COLUMN "weight_kg" numeric(7, 3);--> statement-breakpoint
ALTER TABLE "tanks" ADD COLUMN "dive_phase_code" integer;--> statement-breakpoint
ALTER TABLE "pictures" ADD CONSTRAINT "pictures_dive_id_dives_id_fk" FOREIGN KEY ("dive_id") REFERENCES "public"."dives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pictures" ADD CONSTRAINT "pictures_site_id_dive_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."dive_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pictures" ADD CONSTRAINT "pictures_buddy_id_buddies_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."buddies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pictures" ADD CONSTRAINT "pictures_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pictures" ADD CONSTRAINT "pictures_diver_id_divers_id_fk" FOREIGN KEY ("diver_id") REFERENCES "public"."divers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pictures_source_external_id_unique" ON "pictures" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE INDEX "pictures_dive_id_index" ON "pictures" USING btree ("dive_id");--> statement-breakpoint
CREATE INDEX "pictures_site_id_index" ON "pictures" USING btree ("site_id");--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_diver_id_divers_id_fk" FOREIGN KEY ("diver_id") REFERENCES "public"."divers"("id") ON DELETE set null ON UPDATE no action;