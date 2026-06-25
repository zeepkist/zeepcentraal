ALTER TABLE "level" DROP CONSTRAINT "level_pk";--> statement-breakpoint
ALTER TABLE "level" ADD COLUMN "xx_hash" text;--> statement-breakpoint
CREATE INDEX "IX_level_hash" ON "level" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_level_xx_hash" ON "level" USING btree ("xx_hash") WHERE "level"."xx_hash" IS NOT NULL;