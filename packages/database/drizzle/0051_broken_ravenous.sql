CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "IX_records_user_date_created_id" ON "record" USING btree ("id_user","date_created" DESC NULLS LAST,"id" DESC NULLS LAST,"mod_version");--> statement-breakpoint
CREATE INDEX "IX_records_date_created_id" ON "record" USING btree ("date_created" DESC NULLS LAST,"id" DESC NULLS LAST,"id_level","mod_version");--> statement-breakpoint
CREATE INDEX "IX_records_level_date_created_id" ON "record" USING btree ("id_level","date_created" DESC NULLS LAST,"id" DESC NULLS LAST,"mod_version");--> statement-breakpoint
CREATE INDEX "IX_level_date_created_id" ON "level" USING btree ("date_created" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_level_adventure_date_created_id" ON "level" USING btree ("date_created","id") WHERE "level"."adventure" = true;--> statement-breakpoint
CREATE INDEX "IX_level_item_level_updated_active" ON "level_item" USING btree ("id_level","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "level_item"."deleted" = false;--> statement-breakpoint
CREATE INDEX "IX_level_item_author_created_active" ON "level_item" USING btree ("author_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST,"id_level") WHERE "level_item"."deleted" = false;--> statement-breakpoint
CREATE INDEX "IX_level_points_points_level" ON "level_points" USING btree ("points" DESC NULLS LAST,"id_level");--> statement-breakpoint
CREATE INDEX "IX_level_points_rating_level" ON "level_points" USING btree ("rating" DESC NULLS LAST,"id_level");--> statement-breakpoint
CREATE INDEX "IX_level_points_popularity_level" ON "level_points" USING btree ("modifier_popularity" DESC NULLS LAST,"id_level");--> statement-breakpoint
CREATE INDEX "IX_user_point_contribution_user_value_level" ON "user_point_contribution" USING btree ("id_user","player_decayed_points" DESC NULLS LAST,"id_level");--> statement-breakpoint
CREATE INDEX "IX_user_point_contribution_user_wr_value_level" ON "user_point_contribution" USING btree ("id_user","player_decayed_points" DESC NULLS LAST,"id_level") WHERE "user_point_contribution"."level_position" = 1;--> statement-breakpoint
CREATE INDEX "IX_user_points_rank_ranked" ON "user_points" USING btree ("rank","id_user") WHERE "user_points"."rank" <> -1;--> statement-breakpoint
CREATE INDEX "IX_user_points_points" ON "user_points" USING btree ("points" DESC NULLS LAST,"id_user");--> statement-breakpoint
CREATE INDEX "IX_user_points_total_points" ON "user_points" USING btree ("total_points" DESC NULLS LAST,"id_user");--> statement-breakpoint
CREATE INDEX "IX_user_points_world_records" ON "user_points" USING btree ("world_records" DESC NULLS LAST,"id_user");--> statement-breakpoint
CREATE INDEX "IX_vote_date_created" ON "vote" USING btree ("date_created" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_zsl_level_result_level_position_user" ON "zsl_level_result" USING btree ("id_level","position","id_user");--> statement-breakpoint
CREATE INDEX "IX_zsl_round_result_round_position_user" ON "zsl_round_result" USING btree ("id_round","position","id_user");--> statement-breakpoint
CREATE INDEX "IX_zsl_season_result_season_position_user" ON "zsl_season_result" USING btree ("id_season","position","id_user");--> statement-breakpoint
CREATE INDEX "IX_level_hash_search" ON "level" USING gin ("hash" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "IX_level_xx_hash_search" ON "level" USING gin ("xx_hash" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "IX_level_item_name_search" ON "level_item" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "IX_user_steam_name_search" ON "user" USING gin ("steam_name" gin_trgm_ops);--> statement-breakpoint
DROP INDEX "IX_records_user_date_created";--> statement-breakpoint
DROP INDEX "IX_records_date_created";
