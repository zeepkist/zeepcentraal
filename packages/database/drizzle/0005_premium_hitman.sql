-- 0. Drop unused tables
DROP TABLE IF EXISTS "VersionInfo" CASCADE;

-- Delete NaN records
DELETE FROM "record_media"
WHERE "id_record" IN (
  SELECT id
  FROM "record"
  WHERE EXISTS (
    SELECT 1
    FROM unnest("splits") AS val
    WHERE val IS NOT NULL AND (val > 9223372036854775807 OR val < -9223372036854775808)
  )
);

DELETE FROM "personal_best_global"
WHERE "id_record" IN (
  SELECT id
  FROM "record"
  WHERE EXISTS (
    SELECT 1
    FROM unnest("splits") AS val
    WHERE val IS NOT NULL AND (val > 9223372036854775807 OR val < -9223372036854775808)
  )
);

DELETE FROM "world_record_global"
WHERE "id_record" IN (
  SELECT id
  FROM "record"
  WHERE EXISTS (
    SELECT 1
    FROM unnest("splits") AS val
    WHERE val IS NOT NULL AND (val > 9223372036854775807 OR val < -9223372036854775808)
  )
);

DELETE FROM "record"
WHERE EXISTS (
	SELECT 1
	FROM unnest("splits") as val
	WHERE val IS NOT NULL AND (val > 9223372036854775807 OR val < -9223372036854775808)
);

-- 2. Set Steam, Workshop and Discord IDs to bigint

ALTER TABLE "level_request"
  ALTER COLUMN "workshop_id"
    SET DATA TYPE bigint
    USING GREATEST(LEAST("workshop_id"::bigint, 9223372036854775807), -9223372036854775808);

ALTER TABLE "user"
  ALTER COLUMN "steam_id"
    SET DATA TYPE bigint
    USING GREATEST(LEAST("steam_id"::bigint, 9223372036854775807), -9223372036854775808);

ALTER TABLE "user"
  ALTER COLUMN "discord_id"
    SET DATA TYPE bigint
    USING GREATEST(LEAST("discord_id"::bigint, 9223372036854775807), -9223372036854775808);
