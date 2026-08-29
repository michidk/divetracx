CREATE TABLE "dive_profile_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dive_id" uuid NOT NULL,
	"sample_index" integer NOT NULL,
	"elapsed_seconds" integer NOT NULL,
	"depth_meters" numeric(7, 2) NOT NULL,
	"source_key" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"external_uuid" text,
	"source_updated_at" text,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD CONSTRAINT "dive_profile_samples_dive_id_dives_id_fk" FOREIGN KEY ("dive_id") REFERENCES "public"."dives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dive_profile_samples_dive_source_index_unique" ON "dive_profile_samples" USING btree ("dive_id","source_key","sample_index");--> statement-breakpoint
CREATE INDEX "dive_profile_samples_dive_elapsed_index" ON "dive_profile_samples" USING btree ("dive_id","elapsed_seconds");