ALTER TABLE "level_points" ADD COLUMN "air_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "wheel_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "slip_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points" ADD COLUMN "ragdoll_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "air_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "wheel_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "slip_sample_size" integer;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD COLUMN "ragdoll_sample_size" integer;