ALTER TABLE "dive_profile_samples" ADD COLUMN "temperature_celsius" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD COLUMN "pressure_bar" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD COLUMN "deco_ceiling_meters" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "dive_profile_samples" ADD COLUMN "tank_number" integer;--> statement-breakpoint
ALTER TABLE "tanks" ADD COLUMN "computer_tank_number" integer;