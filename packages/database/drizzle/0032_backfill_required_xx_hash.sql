DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "level" missing_level
		INNER JOIN "level" existing_level
			ON existing_level."xx_hash" = missing_level."id"::text
		WHERE missing_level."xx_hash" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot backfill level.xx_hash from id because generated value conflicts with existing xx_hash';
	END IF;
END $$;
--> statement-breakpoint
WITH missing_levels AS (
	SELECT "id"
	FROM "level"
	WHERE "xx_hash" IS NULL
)
UPDATE "level_item"
SET
	"deleted" = TRUE,
	"date_updated" = now()
FROM missing_levels
WHERE "level_item"."id_level" = missing_levels."id";
--> statement-breakpoint
WITH missing_levels AS (
	SELECT "id"
	FROM "level"
	WHERE "xx_hash" IS NULL
)
INSERT INTO "level_points" (
	"id_level",
	"points",
	"rating",
	"modifier_length",
	"modifier_competitiveness",
	"modifier_rating",
	"modifier_popularity",
	"cut_penalty",
	"date_created",
	"date_updated"
)
SELECT
	missing_levels."id",
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	now(),
	now()
FROM missing_levels
WHERE NOT EXISTS (
	SELECT 1
	FROM "level_points"
	WHERE "level_points"."id_level" = missing_levels."id"
);
--> statement-breakpoint
UPDATE "level"
SET
	"xx_hash" = "id"::text,
	"date_updated" = now()
WHERE "xx_hash" IS NULL;
--> statement-breakpoint
DROP INDEX "UQ_level_xx_hash";
--> statement-breakpoint
ALTER TABLE "level" ALTER COLUMN "xx_hash" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_level_xx_hash" ON "level" USING btree ("xx_hash");
