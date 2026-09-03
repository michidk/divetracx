UPDATE "dive_types"
SET
	"name" = CASE lower("name")
		WHEN 'altitude dive' THEN 'Altitude'
		WHEN 'boat dive' THEN 'Boat'
		WHEN 'cave dive' THEN 'Cave'
		WHEN 'certification dive' THEN 'Certification'
		WHEN 'deep dive' THEN 'Deep'
		WHEN 'drift dive' THEN 'Drift'
		WHEN 'freshwater dive' THEN 'Freshwater'
		WHEN 'ice dive' THEN 'Ice'
		WHEN 'navigation dive' THEN 'Navigation'
		WHEN 'night dive' THEN 'Night'
		WHEN 'photography dive' THEN 'Photography'
		WHEN 'river dive' THEN 'River'
		WHEN 'technical dive' THEN 'Technical'
		WHEN 'wreck dive' THEN 'Wreck'
		ELSE "name"
	END,
	"updated_at" = now()
WHERE lower("name") IN (
	'altitude dive',
	'boat dive',
	'cave dive',
	'certification dive',
	'deep dive',
	'drift dive',
	'freshwater dive',
	'ice dive',
	'navigation dive',
	'night dive',
	'photography dive',
	'river dive',
	'technical dive',
	'wreck dive'
);
