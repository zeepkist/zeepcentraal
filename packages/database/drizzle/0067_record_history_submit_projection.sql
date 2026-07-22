CREATE OR REPLACE FUNCTION zc_private.sync_record_history_records(p_record_ids integer[])
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	DELETE FROM zc_private.record_history_index AS history_entry
	WHERE history_entry.id = ANY(p_record_ids)
		AND (
			NOT EXISTS (
				SELECT 1 FROM public.record AS submitted_record
				WHERE submitted_record.id = history_entry.id
			)
			OR (
				history_entry.history_view = 'personal-bests'
				AND NOT EXISTS (
					SELECT 1 FROM public.personal_best_global AS personal_best
					WHERE personal_best.id_record = history_entry.id
				)
			)
			OR (
				history_entry.history_view = 'world-records'
				AND NOT EXISTS (
					SELECT 1 FROM public.world_record_global AS world_record
					WHERE world_record.id_record = history_entry.id
				)
			)
		);

	WITH affected_records AS (
		SELECT DISTINCT affected_record.id
		FROM unnest(p_record_ids) AS affected_record(id)
	), record_state AS (
		SELECT
			submitted_record.id,
			submitted_record.time,
			submitted_record.date_created,
			submitted_record.id_level,
			submitted_record.id_user,
			EXISTS (
				SELECT 1 FROM public.personal_best_global AS personal_best
				WHERE personal_best.id_record = submitted_record.id
			) AS is_personal_best,
			EXISTS (
				SELECT 1 FROM public.world_record_global AS world_record
				WHERE world_record.id_record = submitted_record.id
			) AS is_world_record,
			contribution.id_record IS NOT NULL AS has_contribution,
			contribution.level_position,
			contribution.contribution_rank,
			contribution.level_points AS contribution_level_points,
			contribution.level_decayed_points,
			contribution.player_decayed_points,
			current_level_points.points AS base_level_points
		FROM affected_records AS affected_record
		INNER JOIN public.record AS submitted_record
			ON submitted_record.id = affected_record.id
		LEFT JOIN LATERAL (
			SELECT selected_contribution.*
			FROM public.user_point_contribution AS selected_contribution
			WHERE selected_contribution.id_record = submitted_record.id
				AND selected_contribution.id_user = submitted_record.id_user
				AND selected_contribution.id_level = submitted_record.id_level
			LIMIT 1
		) AS contribution ON true
		LEFT JOIN public.level_points AS current_level_points
			ON current_level_points.id_level = submitted_record.id_level
	), desired_entries AS (
		SELECT record_state.*, selected_view.history_view
		FROM record_state
		CROSS JOIN LATERAL (
			VALUES
				('recent'::text, true),
				('personal-bests'::text, record_state.is_personal_best),
				('world-records'::text, record_state.is_world_record)
		) AS selected_view(history_view, include_row)
		WHERE selected_view.include_row
	)
	INSERT INTO zc_private.record_history_index (
		history_view,
		id,
		time,
		date_created,
		level_id,
		user_id,
		level_position,
		contribution_rank,
		level_points,
		level_decayed_points,
		player_decayed_points,
		is_personal_best,
		is_world_record,
		has_contribution
	)
	SELECT
		desired_entry.history_view,
		desired_entry.id,
		desired_entry.time,
		desired_entry.date_created,
		desired_entry.id_level,
		desired_entry.id_user,
		CASE WHEN desired_entry.has_contribution THEN desired_entry.level_position END,
		CASE WHEN desired_entry.has_contribution THEN desired_entry.contribution_rank END,
		CASE
			WHEN desired_entry.has_contribution THEN desired_entry.contribution_level_points
			WHEN desired_entry.is_personal_best OR desired_entry.is_world_record
				THEN desired_entry.base_level_points
		END,
		CASE WHEN desired_entry.has_contribution THEN desired_entry.level_decayed_points END,
		CASE WHEN desired_entry.has_contribution THEN desired_entry.player_decayed_points END,
		desired_entry.is_personal_best,
		desired_entry.is_world_record,
		desired_entry.has_contribution
	FROM desired_entries AS desired_entry
	ON CONFLICT (history_view, id) DO UPDATE SET
		time = EXCLUDED.time,
		date_created = EXCLUDED.date_created,
		level_id = EXCLUDED.level_id,
		user_id = EXCLUDED.user_id,
		level_position = EXCLUDED.level_position,
		contribution_rank = EXCLUDED.contribution_rank,
		level_points = EXCLUDED.level_points,
		level_decayed_points = EXCLUDED.level_decayed_points,
		player_decayed_points = EXCLUDED.player_decayed_points,
		is_personal_best = EXCLUDED.is_personal_best,
		is_world_record = EXCLUDED.is_world_record,
		has_contribution = EXCLUDED.has_contribution;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_record_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	INSERT INTO zc_private.record_history_index (
		history_view,
		id,
		time,
		date_created,
		level_id,
		user_id,
		is_personal_best,
		is_world_record,
		has_contribution
	)
	SELECT
		'recent',
		new_record.id,
		new_record.time,
		new_record.date_created,
		new_record.id_level,
		new_record.id_user,
		false,
		false,
		false
	FROM new_records AS new_record
	ON CONFLICT (history_view, id) DO UPDATE SET
		time = EXCLUDED.time,
		date_created = EXCLUDED.date_created,
		level_id = EXCLUDED.level_id,
		user_id = EXCLUDED.user_id;
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_record_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_records(
		ARRAY(SELECT DISTINCT id FROM old_records)
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_record_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_records(
		ARRAY(
			SELECT id FROM old_records
			UNION
			SELECT id FROM new_records
		)
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_relation_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_records(
		ARRAY(SELECT DISTINCT id_record FROM new_relations)
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_relation_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_records(
		ARRAY(SELECT DISTINCT id_record FROM old_relations)
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_relation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_records(
		ARRAY(
			SELECT id_record FROM old_relations
			UNION
			SELECT id_record FROM new_relations
		)
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg__sync_record_history" ON public.record;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg__sync_record_history" ON public.personal_best_global;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg__sync_record_history" ON public.world_record_global;--> statement-breakpoint

CREATE TRIGGER "trg__sync_record_history_insert"
AFTER INSERT ON public.record
REFERENCING NEW TABLE AS new_records
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_record_insert();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_delete"
AFTER DELETE ON public.record
REFERENCING OLD TABLE AS old_records
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_record_delete();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_update"
AFTER UPDATE ON public.record
REFERENCING OLD TABLE AS old_records NEW TABLE AS new_records
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_record_update();--> statement-breakpoint

CREATE TRIGGER "trg__sync_record_history_insert"
AFTER INSERT ON public.personal_best_global
REFERENCING NEW TABLE AS new_relations
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_relation_insert();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_delete"
AFTER DELETE ON public.personal_best_global
REFERENCING OLD TABLE AS old_relations
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_relation_delete();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_update"
AFTER UPDATE ON public.personal_best_global
REFERENCING OLD TABLE AS old_relations NEW TABLE AS new_relations
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_relation_update();--> statement-breakpoint

CREATE TRIGGER "trg__sync_record_history_insert"
AFTER INSERT ON public.world_record_global
REFERENCING NEW TABLE AS new_relations
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_relation_insert();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_delete"
AFTER DELETE ON public.world_record_global
REFERENCING OLD TABLE AS old_relations
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_relation_delete();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_update"
AFTER UPDATE ON public.world_record_global
REFERENCING OLD TABLE AS old_relations NEW TABLE AS new_relations
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_relation_update();--> statement-breakpoint

ALTER FUNCTION zc_private.sync_record_history_records(integer[]) OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_record_insert() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_record_delete() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_record_update() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_relation_insert() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_relation_delete() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_relation_update() OWNER TO CURRENT_USER;--> statement-breakpoint

REVOKE ALL ON FUNCTION zc_private.sync_record_history_records(integer[]) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_record_insert() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_record_delete() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_record_update() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_relation_insert() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_relation_delete() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_relation_update() FROM PUBLIC;
