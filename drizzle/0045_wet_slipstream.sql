CREATE TABLE "dive_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dive_id" uuid NOT NULL,
	"elapsed_seconds" integer NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"tank_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD COLUMN "ndl_seconds" integer;--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD COLUMN "time_to_surface_seconds" integer;--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD COLUMN "cns_percent" integer;--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD COLUMN "nitrogen_load_percent" integer;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "start_cns_percent" integer;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "end_cns_percent" integer;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "oxygen_toxicity_units" integer;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "deco_model" text;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "gradient_factor_low" integer;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "gradient_factor_high" integer;--> statement-breakpoint
ALTER TABLE "tanks" ADD COLUMN "gas_role" text;--> statement-breakpoint
ALTER TABLE "dive_events" ADD CONSTRAINT "dive_events_dive_id_dives_id_fk" FOREIGN KEY ("dive_id") REFERENCES "public"."dives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dive_events_dive_id_index" ON "dive_events" USING btree ("dive_id");