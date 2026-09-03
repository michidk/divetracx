ALTER TABLE "agencies" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "agencies" ADD COLUMN "login_url" text;--> statement-breakpoint
UPDATE "agencies"
SET
	"website_url" = CASE "code"
		WHEN 'padi' THEN 'https://www.padi.com/'
		WHEN 'ssi' THEN 'https://www.divessi.com/'
		WHEN 'naui' THEN 'https://www.naui.org/'
		WHEN 'cmas' THEN 'https://www.cmas.org/'
		WHEN 'bsac' THEN 'https://www.bsac.com/'
		WHEN 'fipsas' THEN 'https://fipsas.it/'
		WHEN 'sdi' THEN 'https://www.tdisdi.com/sdi/'
		WHEN 'tdi' THEN 'https://www.tdisdi.com/tdi/'
		WHEN 'iantd' THEN 'https://iantd.com/'
	END,
	"login_url" = CASE "code"
		WHEN 'padi' THEN 'https://account.padi.com/'
		WHEN 'ssi' THEN 'https://my.divessi.com/login'
		WHEN 'naui' THEN 'https://core.naui.org/signin/'
		WHEN 'cmas' THEN 'https://portal.cmas.org/'
		WHEN 'bsac' THEN 'https://www.bsac.com/my-bsac/'
		WHEN 'fipsas' THEN 'https://fipsas.it/tesseramento-e-affiliazioni/tesseramento/'
		WHEN 'sdi' THEN 'https://members.tdisdi.com/'
		WHEN 'tdi' THEN 'https://members.tdisdi.com/'
		WHEN 'iantd' THEN 'https://www.iantd-members.com/en'
	END,
	"updated_at" = now()
WHERE "code" IN ('padi', 'ssi', 'naui', 'cmas', 'bsac', 'fipsas', 'sdi', 'tdi', 'iantd');--> statement-breakpoint
UPDATE "agencies"
SET
	"logo_src" = CASE "code"
		WHEN 'bsac' THEN '/agency-logos/bsac.svg'
		WHEN 'sdi' THEN '/agency-logos/sdi.svg'
		WHEN 'tdi' THEN '/agency-logos/tdi.svg'
	END,
	"updated_at" = now()
WHERE "code" IN ('bsac', 'sdi', 'tdi');
