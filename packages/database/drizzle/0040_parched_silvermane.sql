ALTER TABLE "user_point_contribution" DROP CONSTRAINT "UQ_user_point_contribution_user_level";--> statement-breakpoint
ALTER TABLE "user_point_contribution" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "user_point_contribution" ADD CONSTRAINT "user_point_contribution_id_user_id_level_pk" PRIMARY KEY("id_user","id_level");
