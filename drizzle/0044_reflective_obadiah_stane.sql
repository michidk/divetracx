ALTER TABLE "dive_profile_samples" ADD COLUMN "heart_rate_bpm" integer;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "average_heart_rate_bpm" integer;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "maximum_heart_rate_bpm" integer;