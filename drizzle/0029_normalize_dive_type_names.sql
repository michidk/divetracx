UPDATE "dive_types"
SET
	"name" = CASE lower("name")
		WHEN 'apnoe' THEN 'Freediving'
		WHEN 'ausbildung' THEN 'Training'
		WHEN 'bergsee' THEN 'Altitude dive'
		WHEN 'bergseetauchgang' THEN 'Altitude dive'
		WHEN 'bergung' THEN 'Recovery'
		WHEN 'bootstauchgang' THEN 'Boat dive'
		WHEN 'eistauchgang' THEN 'Ice dive'
		WHEN 'flußtauchgang' THEN 'River dive'
		WHEN 'fotografie' THEN 'Photography dive'
		WHEN 'fototauchgang' THEN 'Photography dive'
		WHEN 'gruppenführung' THEN 'Group leadership'
		WHEN 'höhlentauchgang' THEN 'Cave dive'
		WHEN 'nachttauchgang' THEN 'Night dive'
		WHEN 'orientierungstauchgang' THEN 'Navigation dive'
		WHEN 'prüfungstauchgang' THEN 'Certification dive'
		WHEN 'schülerausbildung' THEN 'Student training'
		WHEN 'strömungstauchgang' THEN 'Drift dive'
		WHEN 'suchen' THEN 'Search'
		WHEN 'süßwassertauchgang' THEN 'Freshwater dive'
		WHEN 'tauchrettung' THEN 'Rescue'
		WHEN 'technischer tauchgang' THEN 'Technical dive'
		WHEN 'tieftauchgang' THEN 'Deep dive'
		WHEN 'wracktauchgang' THEN 'Wreck dive'
		ELSE "name"
	END,
	"updated_at" = now()
WHERE lower("name") IN (
	'apnoe',
	'ausbildung',
	'bergsee',
	'bergseetauchgang',
	'bergung',
	'bootstauchgang',
	'eistauchgang',
	'flußtauchgang',
	'fotografie',
	'fototauchgang',
	'gruppenführung',
	'höhlentauchgang',
	'nachttauchgang',
	'orientierungstauchgang',
	'prüfungstauchgang',
	'schülerausbildung',
	'strömungstauchgang',
	'suchen',
	'süßwassertauchgang',
	'tauchrettung',
	'technischer tauchgang',
	'tieftauchgang',
	'wracktauchgang'
);
