WITH adventure_environment(xx_hash, uid, environment) AS (
	VALUES
{{values}}
)
UPDATE "level_metadata" AS metadata
SET "environment" = source.environment, "date_updated" = now()
FROM "level" AS level, adventure_environment AS source
WHERE metadata."id_level" = level."id" AND level."adventure" = TRUE
	AND (level."xx_hash" = source.xx_hash OR (level."xx_hash" IS NULL AND level."hash" = source.uid))
	AND metadata."environment" IS DISTINCT FROM source.environment;
