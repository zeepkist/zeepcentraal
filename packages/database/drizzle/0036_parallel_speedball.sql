ALTER TABLE "workshop_item" ADD COLUMN "date_created" timestamp with time zone;--> statement-breakpoint
UPDATE "workshop_item"
SET "date_created" = created."date_created"
FROM (
	SELECT
		"level_item"."workshop_id",
		MIN("level_item"."date_created") AS "date_created"
	FROM "level_item"
	GROUP BY "level_item"."workshop_id"
) created
WHERE "workshop_item"."workshop_id" = created."workshop_id";--> statement-breakpoint
ALTER TABLE "workshop_item" ALTER COLUMN "date_created" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "workshop_item" ALTER COLUMN "date_created" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_item" ADD COLUMN "date_updated" timestamp with time zone DEFAULT now() NOT NULL;
