ALTER TABLE "pictures" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "pictures" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "pictures" ADD COLUMN "byte_size" integer;