ALTER TABLE "favourite" DROP CONSTRAINT "UQ_favourites_user_level";--> statement-breakpoint
ALTER TABLE "favourite" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "favourite" ADD CONSTRAINT "favourite_id_user_id_level_pk" PRIMARY KEY("id_user","id_level");
