DROP VIEW IF EXISTS "public"."sampled_favorite";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_level";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_level_item";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_level_metadata";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_level_points";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_level_request";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_personal_best_global";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_record";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_record_media";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_upvote";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_user";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_user_points";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_version";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."sampled_world_record_global";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_level_item_level" ON "level_item" USING btree ("id_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_level_metadata_level" ON "level_metadata" USING btree ("id_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_level_points_level" ON "level_points" USING btree ("id_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_level_request_workshop_id" ON "level_request" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_level_request_hash" ON "level_request" USING btree ("hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_records_level" ON "record" USING btree ("id_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_records_level_time" ON "record" USING btree ("id_level","time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_favorites_level" ON "favorite" USING btree ("id_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IX_vote_user_level" ON "vote" USING btree ("id_user","id_level");--> statement-breakpoint

-- Add unique constraint (constraints can't use IF NOT EXISTS directly)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'UQ_record_media_record'
          AND table_name = 'record_media'
    ) THEN
        ALTER TABLE "record_media" ADD CONSTRAINT "UQ_record_media_record" UNIQUE("id_record");
    END IF;
END$$;
