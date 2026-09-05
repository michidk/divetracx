ALTER TABLE "dives" ADD COLUMN "safety_stop" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "safety_stop_seconds" integer;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "pressure_group_before_interval" text;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "pressure_group_after_interval" text;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "pressure_group_end" text;--> statement-breakpoint
ALTER TABLE "dives" ADD COLUMN "residual_nitrogen_seconds" integer;