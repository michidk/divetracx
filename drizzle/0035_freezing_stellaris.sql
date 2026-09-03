CREATE TABLE "mcp_settings" (
	"id" text PRIMARY KEY DEFAULT 'instance' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"disabled_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
