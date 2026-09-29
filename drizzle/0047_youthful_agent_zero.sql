CREATE TABLE "logbook_settings" (
	"id" text PRIMARY KEY DEFAULT 'instance' NOT NULL,
	"prior_dive_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
