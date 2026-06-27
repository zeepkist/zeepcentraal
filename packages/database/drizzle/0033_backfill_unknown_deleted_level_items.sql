INSERT INTO "level_item" (
	"id_level",
	"workshop_id",
	"author_id",
	"name",
	"image_url",
	"file_author",
	"file_uid",
	"validation_time_author",
	"validation_time_gold",
	"validation_time_silver",
	"validation_time_bronze",
	"deleted",
	"created_at",
	"updated_at",
	"date_created",
	"date_updated"
)
SELECT
	"level"."id",
	-1::bigint,
	-1::bigint,
	'Unknown Deleted Level',
	'',
	'Unknown Author',
	'',
	0,
	0,
	0,
	0,
	TRUE,
	now(),
	now(),
	now(),
	now()
FROM "level"
WHERE NOT EXISTS (
	SELECT 1
	FROM "level_item"
	WHERE "level_item"."id_level" = "level"."id"
);
