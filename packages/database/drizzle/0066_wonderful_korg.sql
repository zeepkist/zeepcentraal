ALTER TABLE "track_tournament_result" DROP CONSTRAINT "track_tournament_result_record_fkey";
--> statement-breakpoint
ALTER TABLE "track_tournament_result" ADD CONSTRAINT "track_tournament_result_record_fkey" FOREIGN KEY ("id_record") REFERENCES "public"."record"("id") ON DELETE no action ON UPDATE no action;