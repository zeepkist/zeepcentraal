DROP INDEX "UQ_level_xx_hash";--> statement-breakpoint
ALTER TABLE "level" ADD CONSTRAINT "UQ_level_xx_hash" UNIQUE("xx_hash");