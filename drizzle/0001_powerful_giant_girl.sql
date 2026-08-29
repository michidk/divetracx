CREATE TYPE "public"."sync_run_trigger" AS ENUM('manual', 'schedule', 'cli');--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "trigger" "sync_run_trigger" DEFAULT 'manual' NOT NULL;