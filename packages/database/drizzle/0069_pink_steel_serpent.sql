UPDATE "record_statistic"
SET
	"distance_on_tarmac" = CASE
		WHEN "distance_on_tarmac" IS NULL
			AND "distance_on_metal" IS NULL
			AND "distance_on_wood" IS NULL
			THEN NULL
		ELSE COALESCE("distance_on_tarmac", 0)
			+ COALESCE("distance_on_metal", 0)
			+ COALESCE("distance_on_wood", 0)
	END,
	"time_on_tarmac" = CASE
		WHEN "time_on_tarmac" IS NULL
			AND "time_on_metal" IS NULL
			AND "time_on_wood" IS NULL
			THEN NULL
		ELSE COALESCE("time_on_tarmac", 0)
			+ COALESCE("time_on_metal", 0)
			+ COALESCE("time_on_wood", 0)
	END,
	"distance_on_sand" = CASE
		WHEN "distance_on_sand" IS NULL AND "distance_on_snow" IS NULL THEN NULL
		ELSE COALESCE("distance_on_sand", 0) + COALESCE("distance_on_snow", 0)
	END,
	"time_on_sand" = CASE
		WHEN "time_on_sand" IS NULL AND "time_on_snow" IS NULL THEN NULL
		ELSE COALESCE("time_on_sand", 0) + COALESCE("time_on_snow", 0)
	END,
	"distance_on_mud" = CASE
		WHEN "distance_on_mud" IS NULL AND "distance_on_flesh" IS NULL THEN NULL
		ELSE COALESCE("distance_on_mud", 0) + COALESCE("distance_on_flesh", 0)
	END,
	"time_on_mud" = CASE
		WHEN "time_on_mud" IS NULL AND "time_on_flesh" IS NULL THEN NULL
		ELSE COALESCE("time_on_mud", 0) + COALESCE("time_on_flesh", 0)
	END,
	"distance_on_wood" = NULL,
	"time_on_wood" = NULL
WHERE "ghost_version" = 6;--> statement-breakpoint
ALTER TABLE "record_statistic" RENAME COLUMN "distance_on_ice" TO "distance_on_ice1";--> statement-breakpoint
ALTER TABLE "record_statistic" RENAME COLUMN "time_on_ice" TO "time_on_ice1";--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_on_ice2" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_on_ice3" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_on_ice2" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_on_ice3" real;--> statement-breakpoint
ALTER TABLE "record_statistic" DROP COLUMN "distance_on_snow";--> statement-breakpoint
ALTER TABLE "record_statistic" DROP COLUMN "distance_on_metal";--> statement-breakpoint
ALTER TABLE "record_statistic" DROP COLUMN "distance_on_flesh";--> statement-breakpoint
ALTER TABLE "record_statistic" DROP COLUMN "time_on_snow";--> statement-breakpoint
ALTER TABLE "record_statistic" DROP COLUMN "time_on_metal";--> statement-breakpoint
ALTER TABLE "record_statistic" DROP COLUMN "time_on_flesh";
