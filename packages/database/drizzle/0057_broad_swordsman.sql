ALTER TABLE public.level ADD COLUMN record_count bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE public.level_item ADD COLUMN rtm_sample_key double precision DEFAULT random() NOT NULL;--> statement-breakpoint

COMMENT ON COLUMN public.level.record_count IS E'@omit\n@behavior -aggregate -groupBy -havingBy';--> statement-breakpoint
COMMENT ON COLUMN public.level_item.rtm_sample_key IS E'@omit\n@behavior -aggregate -groupBy -havingBy';--> statement-breakpoint

-- Keep the count backfill and trigger replacement in one write-free snapshot. Deployment stops
-- record writers before this migration; the lock also prevents a missed concurrent submission.
LOCK TABLE
	public.level,
	public.level_item,
	public.workshop_item,
	public.record
IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint

UPDATE public.level AS candidate_level
SET
	record_count = record_counts.record_count,
	has_records = true
FROM (
	SELECT submitted_record.id_level, count(*)::bigint AS record_count
	FROM public.record AS submitted_record
	GROUP BY submitted_record.id_level
) AS record_counts
WHERE candidate_level.id = record_counts.id_level;--> statement-breakpoint

DROP TRIGGER IF EXISTS graphql_mark_level_has_records_insert ON public.record;--> statement-breakpoint
DROP TRIGGER IF EXISTS graphql_mark_level_has_records_level_update ON public.record;--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.tg_mark_level_has_records();--> statement-breakpoint

-- Level rows are referenced by each submitted Record. FOR UPDATE conflicts with those foreign-key
-- key-share locks and can deadlock during a first-record burst. FOR NO KEY UPDATE still serializes
-- visibility summaries while remaining compatible with references to the unchanged Level identity.
CREATE OR REPLACE FUNCTION zc_private.sync_public_level_summary(p_level_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
	IF p_level_id IS NULL THEN
		RETURN;
	END IF;

	PERFORM candidate_level.id
	FROM public.level AS candidate_level
	WHERE candidate_level.id = p_level_id
	FOR NO KEY UPDATE OF candidate_level;

	UPDATE public.level AS candidate_level
	SET publicly_visible =
		candidate_level.adventure = true
		OR EXISTS (
			SELECT 1
			FROM public.level_item AS visible_level_item
			WHERE visible_level_item.id_level = candidate_level.id
				AND visible_level_item.publicly_visible = true
		)
	WHERE candidate_level.id = p_level_id
		AND candidate_level.publicly_visible IS DISTINCT FROM (
			candidate_level.adventure = true
			OR EXISTS (
				SELECT 1
				FROM public.level_item AS visible_level_item
				WHERE visible_level_item.id_level = candidate_level.id
					AND visible_level_item.publicly_visible = true
			)
		);

	UPDATE public.level_metadata AS candidate_level_metadata
	SET publicly_visible = candidate_level.publicly_visible
	FROM public.level AS candidate_level
	WHERE candidate_level.id = p_level_id
		AND candidate_level_metadata.id_level = candidate_level.id
		AND candidate_level_metadata.publicly_visible IS DISTINCT FROM candidate_level.publicly_visible;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.sync_public_level_summary(integer) OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.sync_public_level_summary(integer) FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_level_record_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
	source_level_id integer;
	target_level_id integer;
	target_has_records boolean;
	affected_level_id integer;
	affected_workshop_id bigint;
BEGIN
	IF TG_OP = 'INSERT' THEN
		target_level_id := NEW.id_level;
	ELSIF TG_OP = 'DELETE' THEN
		source_level_id := OLD.id_level;
	ELSIF OLD.id_level IS DISTINCT FROM NEW.id_level THEN
		source_level_id := OLD.id_level;
		target_level_id := NEW.id_level;
	ELSE
		RETURN NEW;
	END IF;

	-- First record changes metadata visibility. Preserve the existing Workshop-before-Level lock
	-- order, and lock aliases deterministically, before setting has_records.
	IF target_level_id IS NOT NULL THEN
		SELECT candidate_level.has_records
		INTO target_has_records
		FROM public.level AS candidate_level
		WHERE candidate_level.id = target_level_id;

		IF target_has_records = false THEN
			FOR affected_workshop_id IN
				SELECT DISTINCT candidate_level_item.workshop_id
				FROM public.level_item AS candidate_level_item
				WHERE candidate_level_item.id_level = target_level_id
				ORDER BY candidate_level_item.workshop_id
			LOOP
				PERFORM candidate_workshop_item.workshop_id
				FROM public.workshop_item AS candidate_workshop_item
				WHERE candidate_workshop_item.workshop_id = affected_workshop_id
				FOR UPDATE OF candidate_workshop_item;
			END LOOP;
		END IF;
	END IF;

	-- Record moves lock both Level rows in ascending order. has_records remains sticky even if
	-- administrative deletion reduces the exact count to zero.
	FOR affected_level_id IN
		SELECT DISTINCT candidate_level.candidate_level_id
		FROM unnest(ARRAY[source_level_id, target_level_id]) AS candidate_level(candidate_level_id)
		WHERE candidate_level.candidate_level_id IS NOT NULL
		ORDER BY candidate_level.candidate_level_id
	LOOP
		IF affected_level_id = target_level_id THEN
			UPDATE public.level
			SET
				record_count = record_count + 1,
				has_records = true
			WHERE id = affected_level_id;
		ELSE
			UPDATE public.level
			SET record_count = GREATEST(record_count - 1, 0)
			WHERE id = affected_level_id;
		END IF;
	END LOOP;

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_level_record_count() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_level_record_count() FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE TRIGGER graphql_sync_level_record_count_insert
	AFTER INSERT ON public.record
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_level_record_count();--> statement-breakpoint
CREATE TRIGGER graphql_sync_level_record_count_delete
	AFTER DELETE ON public.record
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_level_record_count();--> statement-breakpoint
CREATE TRIGGER graphql_sync_level_record_count_level_update
	AFTER UPDATE OF id_level ON public.record
	FOR EACH ROW
	WHEN (OLD.id_level IS DISTINCT FROM NEW.id_level)
	EXECUTE FUNCTION zc_private.tg_sync_level_record_count();--> statement-breakpoint

CREATE INDEX "IX_level_item_public_rtm_sample" ON public.level_item USING btree (rtm_sample_key, id) WHERE publicly_visible = true AND deleted = false;--> statement-breakpoint
CREATE INDEX "IX_records_hot_levels_date_level" ON public.record USING btree (date_created DESC NULLS LAST, id_level);--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.hot_levels_since("since" timestamptz)
RETURNS SETOF public.level
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
	WITH public_level_ids AS MATERIALIZED (
		SELECT candidate_level.id
		FROM public.level AS candidate_level
		WHERE candidate_level.publicly_visible = true
	),
	recent_record_counts AS MATERIALIZED (
		SELECT submitted_record.id_level, count(*) AS record_count
		FROM public_level_ids AS public_level
		INNER JOIN public.record AS submitted_record
			ON submitted_record.id_level = public_level.id
		WHERE submitted_record.date_created >= "since"
		GROUP BY submitted_record.id_level
	)
	SELECT visible_level.*
	FROM recent_record_counts
	INNER JOIN public.level AS visible_level
		ON visible_level.id = recent_record_counts.id_level
		AND visible_level.publicly_visible = true
	ORDER BY recent_record_counts.record_count DESC, visible_level.id ASC;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.z_rtm(
	p_min_author_time real DEFAULT NULL::real,
	p_max_author_time real DEFAULT NULL::real,
	p_min_records integer DEFAULT NULL::integer,
	p_max_records integer DEFAULT NULL::integer,
	p_excluded_author_ids bigint[] DEFAULT NULL::bigint[],
	p_excluded_hashes text[] DEFAULT NULL::text[],
	p_min_checkpoints integer DEFAULT NULL::integer,
	p_max_checkpoints integer DEFAULT NULL::integer,
	p_min_finishes integer DEFAULT NULL::integer,
	p_max_finishes integer DEFAULT NULL::integer,
	p_min_blocks integer DEFAULT NULL::integer,
	p_max_blocks integer DEFAULT NULL::integer,
	p_min_points integer DEFAULT NULL::integer,
	p_max_points integer DEFAULT NULL::integer,
	p_sample_size integer DEFAULT 50
)
RETURNS TABLE(
	id integer,
	id_level integer,
	workshop_id bigint,
	author_id bigint,
	name text,
	image_url text,
	file_author text,
	file_uid text,
	validation_time_author real,
	validation_time_gold real,
	validation_time_silver real,
	validation_time_bronze real,
	deleted boolean,
	created_at timestamptz,
	updated_at timestamptz,
	date_created timestamptz,
	date_updated timestamptz,
	amount_checkpoints integer,
	amount_finishes integer,
	amount_blocks integer,
	num_records bigint,
	points integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
ROWS 50
SET search_path = pg_catalog, pg_temp
SET row_security = off
AS $$
DECLARE
	sample_pivot double precision := pg_catalog.random();
BEGIN
	RETURN QUERY
	WITH eligible_candidates AS NOT MATERIALIZED (
		SELECT
			visible_level_item.id,
			visible_level_item.rtm_sample_key
		FROM public.level_item AS visible_level_item
		INNER JOIN public.level AS visible_level
			ON visible_level.id = visible_level_item.id_level
			AND visible_level.publicly_visible = true
		WHERE visible_level_item.publicly_visible = true
			AND visible_level_item.deleted = false
			AND (p_min_author_time IS NULL OR visible_level_item.validation_time_author >= p_min_author_time)
			AND (p_max_author_time IS NULL OR visible_level_item.validation_time_author <= p_max_author_time)
			AND (p_min_records IS NULL OR visible_level.record_count >= p_min_records)
			AND (p_max_records IS NULL OR visible_level.record_count <= p_max_records)
			AND (p_excluded_author_ids IS NULL OR visible_level_item.author_id <> ALL (p_excluded_author_ids))
			AND (p_excluded_hashes IS NULL OR visible_level.hash <> ALL (p_excluded_hashes))
			AND (
				(
					p_min_checkpoints IS NULL
					AND p_max_checkpoints IS NULL
					AND p_min_finishes IS NULL
					AND p_max_finishes IS NULL
					AND p_min_blocks IS NULL
					AND p_max_blocks IS NULL
				)
				OR EXISTS (
					SELECT 1
					FROM public.level_metadata AS visible_level_metadata
					WHERE visible_level_metadata.id_level = visible_level_item.id_level
						AND visible_level_metadata.publicly_visible = true
						AND (p_min_checkpoints IS NULL OR visible_level_metadata.amount_checkpoints >= p_min_checkpoints)
						AND (p_max_checkpoints IS NULL OR visible_level_metadata.amount_checkpoints <= p_max_checkpoints)
						AND (p_min_finishes IS NULL OR visible_level_metadata.amount_finishes >= p_min_finishes)
						AND (p_max_finishes IS NULL OR visible_level_metadata.amount_finishes <= p_max_finishes)
						AND (p_min_blocks IS NULL OR visible_level_metadata.amount_blocks >= p_min_blocks)
						AND (p_max_blocks IS NULL OR visible_level_metadata.amount_blocks <= p_max_blocks)
				)
			)
			AND (
				(p_min_points IS NULL AND p_max_points IS NULL)
				OR EXISTS (
					SELECT 1
					FROM public.level_points AS visible_level_points
					WHERE visible_level_points.id_level = visible_level_item.id_level
						AND (p_min_points IS NULL OR visible_level_points.points >= p_min_points)
						AND (p_max_points IS NULL OR visible_level_points.points <= p_max_points)
				)
			)
	),
	forward_candidates AS MATERIALIZED (
		SELECT eligible_candidate.id, eligible_candidate.rtm_sample_key
		FROM eligible_candidates AS eligible_candidate
		WHERE eligible_candidate.rtm_sample_key >= sample_pivot
		ORDER BY eligible_candidate.rtm_sample_key, eligible_candidate.id
		LIMIT p_sample_size
	),
	wrapped_candidates AS MATERIALIZED (
		SELECT eligible_candidate.id, eligible_candidate.rtm_sample_key
		FROM eligible_candidates AS eligible_candidate
		WHERE eligible_candidate.rtm_sample_key < sample_pivot
		ORDER BY eligible_candidate.rtm_sample_key, eligible_candidate.id
		LIMIT p_sample_size
	),
	selected_candidates AS MATERIALIZED (
		SELECT circular_candidate.id, circular_candidate.rtm_sample_key, circular_candidate.sample_pass
		FROM (
			SELECT forward_candidate.id, forward_candidate.rtm_sample_key, 0 AS sample_pass
			FROM forward_candidates AS forward_candidate
			UNION ALL
			SELECT wrapped_candidate.id, wrapped_candidate.rtm_sample_key, 1 AS sample_pass
			FROM wrapped_candidates AS wrapped_candidate
		) AS circular_candidate
		ORDER BY
			circular_candidate.sample_pass,
			circular_candidate.rtm_sample_key,
			circular_candidate.id
		LIMIT p_sample_size
	)
	SELECT
		visible_level_item.id,
		visible_level_item.id_level,
		visible_level_item.workshop_id,
		visible_level_item.author_id,
		visible_level_item.name,
		visible_level_item.image_url,
		visible_level_item.file_author,
		visible_level_item.file_uid,
		visible_level_item.validation_time_author,
		visible_level_item.validation_time_gold,
		visible_level_item.validation_time_silver,
		visible_level_item.validation_time_bronze,
		visible_level_item.deleted,
		visible_level_item.created_at,
		visible_level_item.updated_at,
		visible_level_item.date_created,
		visible_level_item.date_updated,
		visible_level_metadata.amount_checkpoints,
		visible_level_metadata.amount_finishes,
		visible_level_metadata.amount_blocks,
		visible_level.record_count AS num_records,
		visible_level_points.points
	FROM selected_candidates AS selected_candidate
	INNER JOIN public.level_item AS visible_level_item
		ON visible_level_item.id = selected_candidate.id
		AND visible_level_item.publicly_visible = true
		AND visible_level_item.deleted = false
	INNER JOIN public.level AS visible_level
		ON visible_level.id = visible_level_item.id_level
		AND visible_level.publicly_visible = true
	LEFT JOIN LATERAL (
		SELECT
			candidate_level_metadata.amount_checkpoints,
			candidate_level_metadata.amount_finishes,
			candidate_level_metadata.amount_blocks
		FROM public.level_metadata AS candidate_level_metadata
		WHERE candidate_level_metadata.id_level = visible_level_item.id_level
			AND candidate_level_metadata.publicly_visible = true
			AND (p_min_checkpoints IS NULL OR candidate_level_metadata.amount_checkpoints >= p_min_checkpoints)
			AND (p_max_checkpoints IS NULL OR candidate_level_metadata.amount_checkpoints <= p_max_checkpoints)
			AND (p_min_finishes IS NULL OR candidate_level_metadata.amount_finishes >= p_min_finishes)
			AND (p_max_finishes IS NULL OR candidate_level_metadata.amount_finishes <= p_max_finishes)
			AND (p_min_blocks IS NULL OR candidate_level_metadata.amount_blocks >= p_min_blocks)
			AND (p_max_blocks IS NULL OR candidate_level_metadata.amount_blocks <= p_max_blocks)
		ORDER BY candidate_level_metadata.id DESC
		LIMIT 1
	) AS visible_level_metadata ON true
	LEFT JOIN public.level_points AS visible_level_points
		ON visible_level_points.id_level = visible_level_item.id_level
	ORDER BY
		selected_candidate.sample_pass,
		selected_candidate.rtm_sample_key,
		selected_candidate.id;
END;
$$;--> statement-breakpoint
ALTER FUNCTION public.z_rtm(
	real,
	real,
	integer,
	integer,
	bigint[],
	text[],
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer
) OWNER TO CURRENT_USER;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.hot_levels_since(timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.z_rtm(
	real,
	real,
	integer,
	integer,
	bigint[],
	text[],
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer
) FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.hot_levels_since(timestamptz) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.z_rtm(
	real,
	real,
	integer,
	integer,
	bigint[],
	text[],
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer
) TO zeepcentraal_graphql;
