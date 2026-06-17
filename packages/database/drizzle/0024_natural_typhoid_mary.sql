CREATE INDEX "IX_zsl_level_round" ON "zsl_level" USING btree ("id_round");--> statement-breakpoint
CREATE INDEX "IX_zsl_level_id" ON "zsl_level" USING btree ("id_level");--> statement-breakpoint
CREATE INDEX "IX_zsl_level_result_level" ON "zsl_level_result" USING btree ("id_level");--> statement-breakpoint
CREATE INDEX "IX_zsl_level_result_user" ON "zsl_level_result" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_zsl_level_result_record" ON "zsl_level_result" USING btree ("id_record");--> statement-breakpoint
CREATE INDEX "IX_zsl_level_result_position" ON "zsl_level_result" USING btree ("position");--> statement-breakpoint
CREATE INDEX "IX_zsl_level_result_date_created" ON "zsl_level_result" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "IX_zsl_round_season" ON "zsl_round" USING btree ("id_season");--> statement-breakpoint
CREATE INDEX "IX_zsl_round_workshop_id" ON "zsl_round" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "IX_zsl_round_event_date" ON "zsl_round" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "IX_zsl_round_result_round" ON "zsl_round_result" USING btree ("id_round");--> statement-breakpoint
CREATE INDEX "IX_zsl_round_result_user" ON "zsl_round_result" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_zsl_round_result_position" ON "zsl_round_result" USING btree ("position");--> statement-breakpoint
CREATE INDEX "IX_zsl_round_result_date_created" ON "zsl_round_result" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "IX_zsl_season_result_season" ON "zsl_season_result" USING btree ("id_season");--> statement-breakpoint
CREATE INDEX "IX_zsl_season_result_user" ON "zsl_season_result" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "IX_zsl_season_result_position" ON "zsl_season_result" USING btree ("position");--> statement-breakpoint
CREATE INDEX "IX_zsl_season_result_date_created" ON "zsl_season_result" USING btree ("date_created");