CREATE INDEX "IX_personal_bests_date_created" ON "personal_best_global" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "IX_records_date_created" ON "record" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "IX_world_records_date_created" ON "world_record_global" USING btree ("date_created");