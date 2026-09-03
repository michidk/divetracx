CREATE TYPE "public"."picture_kind" AS ENUM('photo', 'signature');--> statement-breakpoint
ALTER TABLE "pictures" ADD COLUMN "kind" "picture_kind" DEFAULT 'photo' NOT NULL;--> statement-breakpoint
UPDATE "pictures"
SET "kind" = 'signature'
WHERE "path" ~* '(^|/)Signatures?(/|$)|(^|/)Signature_[^/]*$';
