ALTER TABLE "dives" ADD COLUMN "equipment_weight_kg" numeric(7, 3);--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "maximum_ppo2" numeric(8, 6);--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "decompression_dive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "legacy_buddy_text" text;--> statement-breakpoint
UPDATE "dives"
SET "source_payload" = "source_payload" - 'Profile10'
WHERE "source_payload" ? 'Profile10';
