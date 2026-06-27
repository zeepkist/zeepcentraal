CREATE TABLE "workshop_item" (
	"workshop_id" bigint PRIMARY KEY NOT NULL,
	"author_id" bigint NOT NULL,
	"name" text NOT NULL,
	"image_url" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "level_item" ALTER COLUMN "workshop_id" SET DATA TYPE bigint USING "workshop_id"::bigint;--> statement-breakpoint
ALTER TABLE "level_item" ALTER COLUMN "author_id" SET DATA TYPE bigint USING "author_id"::bigint;--> statement-breakpoint
INSERT INTO "user" (
	"steam_name",
	"banned",
	"steam_id",
	"discord_id",
	"date_created",
	"date_updated"
)
SELECT
	'Unknown',
	FALSE,
	authors."author_id",
	-1::bigint,
	now(),
	now()
FROM (
	SELECT DISTINCT "level_item"."author_id"
	FROM "level_item"
) authors
WHERE NOT EXISTS (
	SELECT 1
	FROM "user"
	WHERE "user"."steam_id" = authors."author_id"
);
--> statement-breakpoint
DROP INDEX "UQ_user_steam_id";--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_user_steam_id" ON "user" USING btree ("steam_id");--> statement-breakpoint
INSERT INTO "workshop_item" (
	"workshop_id",
	"author_id",
	"name",
	"image_url"
)
SELECT DISTINCT ON ("level_item"."workshop_id")
	"level_item"."workshop_id",
	"level_item"."author_id",
	'',
	"level_item"."image_url"
FROM "level_item"
ORDER BY "level_item"."workshop_id", "level_item"."id";
--> statement-breakpoint
ALTER TABLE "workshop_item" ADD CONSTRAINT "workshop_item_author_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("steam_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_item" ADD CONSTRAINT "level_item_workshop_item_fkey" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop_item"("workshop_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_item" ADD CONSTRAINT "level_item_author_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("steam_id") ON DELETE no action ON UPDATE no action;
