DROP INDEX "IX_auth_user";--> statement-breakpoint
DROP INDEX "IX_favorites_user";--> statement-breakpoint
DROP INDEX "IX_personal_bests_record";--> statement-breakpoint
DROP INDEX "IX_personal_bests_user";--> statement-breakpoint
DROP INDEX "IX_personal_bests_level_user";--> statement-breakpoint
DROP INDEX "IX_personal_bests_user_level_record";--> statement-breakpoint
DROP INDEX "IX_records_user";--> statement-breakpoint
DROP INDEX "IX_media_record";--> statement-breakpoint
DROP INDEX "IX_upvotes_user";--> statement-breakpoint
DROP INDEX "IX_player_points_user";--> statement-breakpoint
DROP INDEX "UC_Version";--> statement-breakpoint
DROP INDEX "IX_world_records_record";--> statement-breakpoint
DROP INDEX "IX_world_records_user";--> statement-breakpoint
DROP INDEX "IX_world_records_level";--> statement-breakpoint
ALTER TABLE "world_record_global" ALTER COLUMN "id_user" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "IX_auth_user" ON "auth" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_favorites_user" ON "favorite" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_personal_bests_record" ON "personal_best_global" USING btree ("id_record");--> statement-breakpoint
CREATE INDEX "IX_personal_bests_user" ON "personal_best_global" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_personal_bests_level_user" ON "personal_best_global" USING btree ("id_level","id_user");--> statement-breakpoint
CREATE INDEX "IX_personal_bests_user_level_record" ON "personal_best_global" USING btree ("id_user","id_level","id_record");--> statement-breakpoint
CREATE INDEX "IX_records_user" ON "record" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_media_record" ON "record_media" USING btree ("id_record");--> statement-breakpoint
CREATE INDEX "IX_upvotes_user" ON "upvote" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_player_points_user" ON "user_points" USING btree ("id_user");--> statement-breakpoint
CREATE UNIQUE INDEX "UC_Version" ON "VersionInfo" USING btree ("Version");--> statement-breakpoint
CREATE INDEX "IX_world_records_record" ON "world_record_global" USING btree ("id_record");--> statement-breakpoint
CREATE INDEX "IX_world_records_user" ON "world_record_global" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_world_records_level" ON "world_record_global" USING btree ("id_level");