ALTER TABLE "certifications" ADD COLUMN "agency_code" text;--> statement-breakpoint
ALTER TABLE "certifications" ADD COLUMN "custom_agency_name" text;--> statement-breakpoint
UPDATE "certifications"
SET
	"agency_code" = CASE
		WHEN lower(btrim("organization")) IN ('padi', 'professional association of diving instructors') THEN 'padi'
		WHEN lower(btrim("organization")) IN ('ssi', 'scuba schools international') THEN 'ssi'
		WHEN lower(btrim("organization")) IN ('naui', 'national association of underwater instructors') THEN 'naui'
		WHEN lower(btrim("organization")) IN ('cmas', 'confédération mondiale des activités subaquatiques') THEN 'cmas'
		WHEN lower(btrim("organization")) IN ('bsac', 'british sub-aqua club') THEN 'bsac'
		WHEN lower(btrim("organization")) IN ('fipsas', 'federazione italiana pesca sportiva e attività subacquee') THEN 'fipsas'
		WHEN lower(btrim("organization")) IN ('sdi', 'scuba diving international') THEN 'sdi'
		WHEN lower(btrim("organization")) IN ('tdi', 'technical diving international') THEN 'tdi'
		WHEN lower(btrim("organization")) IN ('iantd', 'international association of nitrox and technical divers') THEN 'iantd'
		ELSE 'custom'
	END,
	"custom_agency_name" = CASE
		WHEN lower(btrim("organization")) IN (
			'padi', 'professional association of diving instructors',
			'ssi', 'scuba schools international',
			'naui', 'national association of underwater instructors',
			'cmas', 'confédération mondiale des activités subaquatiques',
			'bsac', 'british sub-aqua club',
			'fipsas', 'federazione italiana pesca sportiva e attività subacquee',
			'sdi', 'scuba diving international',
			'tdi', 'technical diving international',
			'iantd', 'international association of nitrox and technical divers'
		) THEN NULL
		ELSE btrim("organization")
	END
WHERE nullif(btrim("organization"), '') IS NOT NULL;
