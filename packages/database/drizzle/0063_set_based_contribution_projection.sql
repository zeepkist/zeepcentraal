CREATE INDEX IF NOT EXISTS "IX_record_history_index_record"
ON "zc_private"."record_history_index" USING btree ("id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.sync_record_history_contributions(p_record_ids integer[])
RETURNS void
LANGUAGE sql
SET search_path = pg_catalog
AS $$
	WITH affected_records AS (
		SELECT DISTINCT affected_record.id_record
		FROM unnest(p_record_ids) AS affected_record(id_record)
	), contribution_values AS (
		SELECT
			affected_record.id_record,
			contribution.id_record IS NOT NULL AS has_contribution,
			contribution.level_position,
			contribution.contribution_rank,
			contribution.level_points,
			contribution.level_decayed_points,
			contribution.player_decayed_points,
			current_level_points.points AS base_level_points
		FROM affected_records AS affected_record
		INNER JOIN public.record AS submitted_record
			ON submitted_record.id = affected_record.id_record
		LEFT JOIN public.user_point_contribution AS contribution
			ON contribution.id_record = submitted_record.id
			AND contribution.id_user = submitted_record.id_user
			AND contribution.id_level = submitted_record.id_level
		LEFT JOIN public.level_points AS current_level_points
			ON current_level_points.id_level = submitted_record.id_level
	)
	UPDATE zc_private.record_history_index AS history_entry
	SET
		level_position = CASE
			WHEN contribution_values.has_contribution THEN contribution_values.level_position
			ELSE NULL
		END,
		contribution_rank = CASE
			WHEN contribution_values.has_contribution THEN contribution_values.contribution_rank
			ELSE NULL
		END,
		level_points = CASE
			WHEN contribution_values.has_contribution THEN contribution_values.level_points
			WHEN history_entry.is_personal_best OR history_entry.is_world_record
				THEN contribution_values.base_level_points
			ELSE NULL
		END,
		level_decayed_points = CASE
			WHEN contribution_values.has_contribution THEN contribution_values.level_decayed_points
			ELSE NULL
		END,
		player_decayed_points = CASE
			WHEN contribution_values.has_contribution THEN contribution_values.player_decayed_points
			ELSE NULL
		END,
		has_contribution = contribution_values.has_contribution
	FROM contribution_values
	WHERE history_entry.id = contribution_values.id_record
		AND ROW(
			history_entry.level_position,
			history_entry.contribution_rank,
			history_entry.level_points,
			history_entry.level_decayed_points,
			history_entry.player_decayed_points,
			history_entry.has_contribution
		) IS DISTINCT FROM ROW(
			CASE
				WHEN contribution_values.has_contribution THEN contribution_values.level_position
				ELSE NULL
			END,
			CASE
				WHEN contribution_values.has_contribution THEN contribution_values.contribution_rank
				ELSE NULL
			END,
			CASE
				WHEN contribution_values.has_contribution THEN contribution_values.level_points
				WHEN history_entry.is_personal_best OR history_entry.is_world_record
					THEN contribution_values.base_level_points
				ELSE NULL
			END,
			CASE
				WHEN contribution_values.has_contribution
					THEN contribution_values.level_decayed_points
				ELSE NULL
			END,
			CASE
				WHEN contribution_values.has_contribution
					THEN contribution_values.player_decayed_points
				ELSE NULL
			END,
			contribution_values.has_contribution
		);
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_contribution_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_contributions(
		ARRAY(
			SELECT DISTINCT id_record
			FROM new_contributions
		)
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_contribution_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_contributions(
		ARRAY(
			SELECT DISTINCT id_record
			FROM old_contributions
		)
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_contribution_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_record_history_contributions(
		ARRAY(
			SELECT id_record FROM old_contributions
			UNION
			SELECT id_record FROM new_contributions
		)
	);
	RETURN NULL;
END;
$$;--> statement-breakpoint

ALTER FUNCTION zc_private.sync_record_history_contributions(integer[]) OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.sync_record_history_contributions(integer[]) FROM PUBLIC;
