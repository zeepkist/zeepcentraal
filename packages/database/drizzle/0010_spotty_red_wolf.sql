ALTER TABLE "auth" DROP CONSTRAINT "auth_user_foreign";
--> statement-breakpoint
ALTER TABLE "favourite" DROP CONSTRAINT "favorite_level_fkey";
--> statement-breakpoint
ALTER TABLE "favourite" DROP CONSTRAINT "favorites_user_foreign";
--> statement-breakpoint
ALTER TABLE "level_item" DROP CONSTRAINT "level_item_id_level_fkey";
--> statement-breakpoint
ALTER TABLE "level_metadata" DROP CONSTRAINT "level_metadata_id_level_fkey";
--> statement-breakpoint
ALTER TABLE "level_points" DROP CONSTRAINT "level_points_level_fkey";
--> statement-breakpoint
ALTER TABLE "level_points_history" DROP CONSTRAINT "level_points_history_level_fkey";
--> statement-breakpoint
ALTER TABLE "personal_best_global" DROP CONSTRAINT "personal_best_global_level_fkey";
--> statement-breakpoint
ALTER TABLE "personal_best_global" DROP CONSTRAINT "personal_bests_global_record_fkey";
--> statement-breakpoint
ALTER TABLE "personal_best_global" DROP CONSTRAINT "personal_bests_global_user_fkey";
--> statement-breakpoint
ALTER TABLE "record" DROP CONSTRAINT "record_level_fkey";
--> statement-breakpoint
ALTER TABLE "record" DROP CONSTRAINT "records_user_foreign";
--> statement-breakpoint
ALTER TABLE "record_media" DROP CONSTRAINT "media_record_fkey";
--> statement-breakpoint
ALTER TABLE "user_points" DROP CONSTRAINT "player_points_user_fkey";
--> statement-breakpoint
ALTER TABLE "user_points_history" DROP CONSTRAINT "user_points_history_user_fkey";
--> statement-breakpoint
ALTER TABLE "vote" DROP CONSTRAINT "vote_id_level_fkey";
--> statement-breakpoint
ALTER TABLE "vote" DROP CONSTRAINT "vote_id_user_fkey";
--> statement-breakpoint
ALTER TABLE "world_record_global" DROP CONSTRAINT "world_record_global_level_fkey";
--> statement-breakpoint
ALTER TABLE "world_record_global" DROP CONSTRAINT "world_records_global_record_fkey";
--> statement-breakpoint
ALTER TABLE "world_record_global" DROP CONSTRAINT "world_records_global_user_fkey";
--> statement-breakpoint
ALTER TABLE "auth" ADD CONSTRAINT "auth_user_foreign" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite" ADD CONSTRAINT "favorite_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite" ADD CONSTRAINT "favorites_user_foreign" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_item" ADD CONSTRAINT "level_item_id_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_metadata" ADD CONSTRAINT "level_metadata_id_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_points" ADD CONSTRAINT "level_points_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_points_history" ADD CONSTRAINT "level_points_history_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_best_global" ADD CONSTRAINT "personal_best_global_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_best_global" ADD CONSTRAINT "personal_bests_global_record_fkey" FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_best_global" ADD CONSTRAINT "personal_bests_global_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "record_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record" ADD CONSTRAINT "records_user_foreign" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_media" ADD CONSTRAINT "media_record_fkey" FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_points" ADD CONSTRAINT "player_points_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_points_history" ADD CONSTRAINT "user_points_history_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_id_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_record_global" ADD CONSTRAINT "world_record_global_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_record_global" ADD CONSTRAINT "world_records_global_record_fkey" FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_record_global" ADD CONSTRAINT "world_records_global_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;