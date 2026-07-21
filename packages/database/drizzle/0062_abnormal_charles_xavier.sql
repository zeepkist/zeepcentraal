CREATE INDEX IF NOT EXISTS "IX_record_history_index_level_projection" ON "zc_private"."record_history_index" USING btree ("level_id") WHERE "zc_private"."record_history_index"."has_contribution" = false AND ("zc_private"."record_history_index"."is_personal_best" OR "zc_private"."record_history_index"."is_world_record");--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_level_points()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	IF TG_OP = 'UPDATE'
		AND OLD.id_level = NEW.id_level
		AND OLD.points IS NOT DISTINCT FROM NEW.points THEN
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.id_level <> NEW.id_level) THEN
		UPDATE zc_private.record_history_index
		SET level_points = NULL
		WHERE level_id = OLD.id_level
			AND has_contribution = false
			AND (is_personal_best OR is_world_record)
			AND level_points IS NOT NULL;
	END IF;

	IF TG_OP <> 'DELETE' THEN
		UPDATE zc_private.record_history_index
		SET level_points = NEW.points
		WHERE level_id = NEW.id_level
			AND has_contribution = false
			AND (is_personal_best OR is_world_record)
			AND level_points IS DISTINCT FROM NEW.points;
		RETURN NEW;
	END IF;
	RETURN OLD;
END;
$$;
