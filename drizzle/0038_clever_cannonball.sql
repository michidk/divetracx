CREATE TABLE "garmin_accounts" (
	"id" text PRIMARY KEY DEFAULT 'instance' NOT NULL,
	"oauth1_token" jsonb,
	"oauth2_token" jsonb,
	"tokens_saved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
