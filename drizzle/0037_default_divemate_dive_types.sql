-- Custom SQL migration file, put your code below! --
INSERT INTO "dive_types" ("name", "sort_order")
SELECT "name", "sort_order"
FROM (
  VALUES
    ('Freediving', 1),
    ('Training', 2),
    ('Altitude', 3),
    ('Recovery', 4),
    ('Boat', 5),
    ('Ice', 6),
    ('River', 7),
    ('Photography', 8),
    ('Group leadership', 9),
    ('Cave', 10),
    ('Night', 11),
    ('Navigation', 12),
    ('Certification', 13),
    ('Student training', 14),
    ('Drift', 15),
    ('Search', 16),
    ('Freshwater', 17),
    ('Rescue', 18),
    ('Technical', 19),
    ('Deep', 20),
    ('Wreck', 21)
) AS "defaults"("name", "sort_order")
WHERE NOT EXISTS (
  SELECT 1
  FROM "dive_types"
  WHERE lower(trim("dive_types"."name")) = lower("defaults"."name")
);
