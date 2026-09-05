CREATE TABLE "dive_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_dive_id" uuid NOT NULL,
	"segment_index" integer NOT NULL,
	"offset_seconds" integer NOT NULL,
	"source_dive_id" uuid NOT NULL,
	"source_label" text NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD COLUMN "segment_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dive_merges" ADD CONSTRAINT "dive_merges_target_dive_id_dives_id_fk" FOREIGN KEY ("target_dive_id") REFERENCES "public"."dives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dive_merges_target_dive_id_index" ON "dive_merges" USING btree ("target_dive_id");