ALTER TABLE "level" ADD COLUMN "adventure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "level_metadata" ADD COLUMN "format" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DELETE FROM "level_request" older
USING "level_request" newer
WHERE older."workshop_id" = newer."workshop_id"
	AND older."id" > newer."id";--> statement-breakpoint
ALTER TABLE "level_request" ADD CONSTRAINT "UQ_level_request_workshop_id" UNIQUE("workshop_id");
