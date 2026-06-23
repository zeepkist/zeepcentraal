UPDATE "version"
SET "minimum" = '1.0.0',
	"date_updated" = NOW();
--> statement-breakpoint
INSERT INTO "version" ("minimum", "latest")
SELECT '1.0.0', '1.0.0'
WHERE NOT EXISTS (SELECT 1 FROM "version");
