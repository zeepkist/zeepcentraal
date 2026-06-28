ALTER TABLE "workshop_item" ADD COLUMN "visibility" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_item" ADD COLUMN "file_size" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_item" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_item" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "workshop_item"
SET
	"created_at" = "source"."created_at",
	"updated_at" = "source"."updated_at"
FROM (
	SELECT
		"workshop_id",
		MIN("created_at") AS "created_at",
		MAX("updated_at") AS "updated_at"
	FROM "level_item"
	GROUP BY "workshop_id"
) AS "source"
WHERE "workshop_item"."workshop_id" = "source"."workshop_id";
