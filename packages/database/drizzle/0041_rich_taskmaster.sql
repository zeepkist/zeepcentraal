ALTER TABLE "record_media" DROP CONSTRAINT "UQ_record_media_record";--> statement-breakpoint
ALTER TABLE "vote" DROP CONSTRAINT "UQ_vote_user_level";--> statement-breakpoint
DROP INDEX "UQ_level_points_level";--> statement-breakpoint
DROP INDEX "UQ_player_points_user";--> statement-breakpoint
ALTER TABLE "level_points" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "record_media" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "user_points" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "vote" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "level_points" ADD PRIMARY KEY ("id_level");--> statement-breakpoint
ALTER TABLE "record_media" ADD PRIMARY KEY ("id_record");--> statement-breakpoint
ALTER TABLE "user_points" ADD PRIMARY KEY ("id_user");--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_id_user_id_level_pk" PRIMARY KEY("id_user","id_level");
