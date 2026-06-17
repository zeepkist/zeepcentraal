ALTER TABLE "level_points" ADD COLUMN "cut_penalty" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "cut_penalty" real DEFAULT 1 NOT NULL;