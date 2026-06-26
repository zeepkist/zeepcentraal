UPDATE "version"
SET "minimum" = '1.1.1',
	"latest" = '1.1.1',
	"date_updated" = NOW();
--> statement-breakpoint
INSERT INTO "version" ("minimum", "latest")
SELECT '1.1.1', '1.1.1'
WHERE NOT EXISTS (SELECT 1 FROM "version");
