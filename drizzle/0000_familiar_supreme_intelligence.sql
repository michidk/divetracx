CREATE TYPE "public"."sync_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "buddies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"city" text,
	"country" text,
	"notes" text,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diver_id" uuid,
	"name" text NOT NULL,
	"organization" text,
	"certification_number" text,
	"certified_at" date,
	"instructor_name" text,
	"instructor_number" text,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dive_buddies" (
	"dive_id" uuid NOT NULL,
	"buddy_id" uuid NOT NULL,
	"source_key" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "dive_buddies_dive_id_buddy_id_source_key_pk" PRIMARY KEY("dive_id","buddy_id","source_key")
);
--> statement-breakpoint
CREATE TABLE "dive_equipment" (
	"dive_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"source_key" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "dive_equipment_dive_id_equipment_id_source_key_pk" PRIMARY KEY("dive_id","equipment_id","source_key")
);
--> statement-breakpoint
CREATE TABLE "dive_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"region" text,
	"water_name" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"source_latitude" text,
	"source_longitude" text,
	"maximum_depth_meters" numeric(7, 2),
	"altitude_meters" integer,
	"difficulty" text,
	"rating" integer,
	"water_type" integer,
	"notes" text,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dive_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
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
CREATE TABLE "divers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"birth_date" date,
	"blood_group" text,
	"emergency_contact" text,
	"emergency_phone" text,
	"insurance" text,
	"notes" text,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diver_id" uuid,
	"site_id" uuid,
	"shop_id" uuid,
	"dive_type_id" uuid,
	"number" integer,
	"dive_date" date NOT NULL,
	"entry_time" time,
	"utc_offset_minutes" integer,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"surface_interval_seconds" integer,
	"maximum_depth_meters" numeric(7, 2),
	"average_depth_meters" numeric(7, 2),
	"air_temperature_celsius" numeric(5, 2),
	"water_temperature_celsius" numeric(5, 2),
	"weight_kg" numeric(7, 3),
	"visibility" text,
	"current" text,
	"waves" text,
	"weather" text,
	"water_type" integer,
	"entry_type" integer,
	"rating" integer,
	"computer" text,
	"suit" text,
	"boat" text,
	"divemaster" text,
	"notes" text,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"purchased_at" date,
	"retired_at" date,
	"service_due_at" date,
	"inactive" boolean DEFAULT false NOT NULL,
	"weight_kg" numeric(7, 3),
	"notes" text,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" text NOT NULL,
	"status" "sync_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"source_fingerprint" text,
	"counts" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "tanks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dive_id" uuid NOT NULL,
	"name" text,
	"sort_order" integer,
	"tank_type" integer,
	"volume_liters" numeric(7, 2),
	"start_pressure_bar" numeric(7, 2),
	"end_pressure_bar" numeric(7, 2),
	"oxygen_percent" numeric(5, 2),
	"helium_percent" numeric(5, 2),
	"breathing_time_seconds" integer,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_diver_id_divers_id_fk" FOREIGN KEY ("diver_id") REFERENCES "public"."divers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dive_buddies" ADD CONSTRAINT "dive_buddies_dive_id_dives_id_fk" FOREIGN KEY ("dive_id") REFERENCES "public"."dives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dive_buddies" ADD CONSTRAINT "dive_buddies_buddy_id_buddies_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."buddies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dive_equipment" ADD CONSTRAINT "dive_equipment_dive_id_dives_id_fk" FOREIGN KEY ("dive_id") REFERENCES "public"."dives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dive_equipment" ADD CONSTRAINT "dive_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dives" ADD CONSTRAINT "dives_diver_id_divers_id_fk" FOREIGN KEY ("diver_id") REFERENCES "public"."divers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dives" ADD CONSTRAINT "dives_site_id_dive_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."dive_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dives" ADD CONSTRAINT "dives_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dives" ADD CONSTRAINT "dives_dive_type_id_dive_types_id_fk" FOREIGN KEY ("dive_type_id") REFERENCES "public"."dive_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tanks" ADD CONSTRAINT "tanks_dive_id_dives_id_fk" FOREIGN KEY ("dive_id") REFERENCES "public"."dives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "buddies_source_external_id_unique" ON "buddies" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certifications_source_external_id_unique" ON "certifications" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dive_sites_source_external_id_unique" ON "dive_sites" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE INDEX "dive_sites_name_index" ON "dive_sites" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "dive_types_source_external_id_unique" ON "dive_types" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "divers_source_external_id_unique" ON "divers" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dives_source_external_id_unique" ON "dives" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE INDEX "dives_dive_date_index" ON "dives" USING btree ("dive_date");--> statement-breakpoint
CREATE INDEX "dives_site_id_index" ON "dives" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_source_external_id_unique" ON "equipment" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shops_source_external_id_unique" ON "shops" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE INDEX "sync_runs_started_at_index" ON "sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tanks_source_external_id_unique" ON "tanks" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE INDEX "tanks_dive_id_index" ON "tanks" USING btree ("dive_id");