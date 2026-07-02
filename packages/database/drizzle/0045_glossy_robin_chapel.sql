DROP INDEX "IX_favorites_user";--> statement-breakpoint
DROP INDEX "IX_level_request_workshop_id";--> statement-breakpoint
DROP INDEX "IX_personal_bests_user";--> statement-breakpoint
DROP INDEX "IX_personal_bests_user_level_record";--> statement-breakpoint
DROP INDEX "IX_records_id_time";--> statement-breakpoint
DROP INDEX "IX_records_level";--> statement-breakpoint
DROP INDEX "IX_records_level_time";--> statement-breakpoint
DROP INDEX "IX_records_time_id";--> statement-breakpoint
DROP INDEX "IX_records_user";--> statement-breakpoint
DROP INDEX "IX_records_user_level_time";--> statement-breakpoint
DROP INDEX "IX_records_user_level_date_created";--> statement-breakpoint
DROP INDEX "IX_media_record";--> statement-breakpoint
DROP INDEX "IX_vote_user_level";--> statement-breakpoint
DROP INDEX "IX_world_records_level";--> statement-breakpoint
DROP INDEX "IX_zsl_level_result_level";--> statement-breakpoint
DROP INDEX "IX_zsl_round_result_round";--> statement-breakpoint
DROP INDEX "IX_zsl_season_result_season";--> statement-breakpoint
ALTER TABLE "level_points" ADD CONSTRAINT "level_points_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_media" ADD CONSTRAINT "media_record_fkey" FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD CONSTRAINT "record_statistic_record_fkey" FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_points" ADD CONSTRAINT "user_points_user_fkey" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_level_item_workshop_deleted" ON "level_item" USING btree ("workshop_id","deleted");--> statement-breakpoint
CREATE INDEX "IX_level_item_workshop_file_uid" ON "level_item" USING btree ("workshop_id","file_uid");--> statement-breakpoint
CREATE INDEX "IX_level_item_workshop_level" ON "level_item" USING btree ("workshop_id","id_level");--> statement-breakpoint
CREATE INDEX "IX_level_item_author" ON "level_item" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "IX_records_level_time_id" ON "record" USING btree ("id_level","time","id");--> statement-breakpoint
CREATE INDEX "IX_records_user_date_created" ON "record" USING btree ("id_user","date_created" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IX_user_point_contribution_record" ON "user_point_contribution" USING btree ("id_record");--> statement-breakpoint
CREATE INDEX "IX_workshop_item_author" ON "workshop_item" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "IX_zsl_season_points_structure" ON "zsl_season" USING btree ("id_points_structure");