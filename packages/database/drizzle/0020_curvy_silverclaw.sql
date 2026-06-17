ALTER TABLE "level_points_history" ADD COLUMN "rating" real DEFAULT 0.6 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "modifier_length" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "modifier_competitiveness" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "modifier_rating" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "modifier_popularity" real DEFAULT 1 NOT NULL;