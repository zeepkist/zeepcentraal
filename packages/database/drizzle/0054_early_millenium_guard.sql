DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_catalog.pg_roles
		WHERE rolname = 'zeepcentraal_graphql'
	) THEN
		CREATE ROLE zeepcentraal_graphql;
	END IF;
END
$$;--> statement-breakpoint
ALTER ROLE zeepcentraal_graphql WITH
	LOGIN
	NOSUPERUSER
	NOCREATEDB
	NOCREATEROLE
	NOINHERIT
	NOREPLICATION
	NOBYPASSRLS;--> statement-breakpoint

CREATE SCHEMA IF NOT EXISTS zc_private;--> statement-breakpoint
ALTER SCHEMA zc_private OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON SCHEMA zc_private FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.is_visible_level(p_level_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.level AS visible_level
		WHERE visible_level.id = p_level_id
			AND (
				visible_level.adventure = true
				OR NOT EXISTS (
					SELECT 1
					FROM public.level_item AS any_level_item
					WHERE any_level_item.id_level = visible_level.id
				)
				OR EXISTS (
					SELECT 1
					FROM public.level_item AS visible_level_item
					INNER JOIN public.workshop_item AS visible_workshop_item
						ON visible_workshop_item.workshop_id = visible_level_item.workshop_id
					WHERE visible_level_item.id_level = visible_level.id
						AND visible_level_item.deleted = false
						AND (
							visible_workshop_item.visibility = 0
							OR (
								visible_workshop_item.visibility = 3
								AND EXISTS (
									SELECT 1
									FROM public.record AS submitted_record
									WHERE submitted_record.id_level = visible_level.id
								)
							)
						)
				)
			)
	);
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.is_visible_level(integer) OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.is_visible_level_item(p_level_item_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.level_item AS visible_level_item
		INNER JOIN public.workshop_item AS visible_workshop_item
			ON visible_workshop_item.workshop_id = visible_level_item.workshop_id
		WHERE visible_level_item.id = p_level_item_id
			AND visible_level_item.deleted = false
			AND (
				visible_workshop_item.visibility = 0
				OR (
					visible_workshop_item.visibility = 3
					AND EXISTS (
						SELECT 1
						FROM public.record AS submitted_record
						WHERE submitted_record.id_level = visible_level_item.id_level
					)
				)
			)
	);
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.is_visible_level_item(integer) OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.is_visible_workshop_item(p_workshop_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.workshop_item AS visible_workshop_item
		WHERE visible_workshop_item.workshop_id = p_workshop_id
			AND EXISTS (
				SELECT 1
				FROM public.level_item AS visible_level_item
				WHERE visible_level_item.workshop_id = visible_workshop_item.workshop_id
					AND visible_level_item.deleted = false
					AND (
						visible_workshop_item.visibility = 0
						OR (
							visible_workshop_item.visibility = 3
							AND EXISTS (
								SELECT 1
								FROM public.record AS submitted_record
								WHERE submitted_record.id_level = visible_level_item.id_level
							)
						)
					)
			)
	);
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.is_visible_workshop_item(bigint) OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.is_visible_record(p_record_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.record AS visible_record
		WHERE visible_record.id = p_record_id
			AND zc_private.is_visible_level(visible_record.id_level)
	);
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.is_visible_record(integer) OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.is_visible_zsl_level(p_zsl_level_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.zsl_level AS visible_zsl_level
		WHERE visible_zsl_level.id = p_zsl_level_id
			AND zc_private.is_visible_level(visible_zsl_level.id_level)
	);
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.is_visible_zsl_level(integer) OWNER TO CURRENT_USER;--> statement-breakpoint

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA zc_private FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA zc_private TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_level(integer) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_level_item(integer) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_workshop_item(bigint) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_record(integer) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_zsl_level(integer) TO zeepcentraal_graphql;--> statement-breakpoint

ALTER TABLE public.favourite ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.level ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.level_item ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.level_metadata ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.level_points ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.level_points_history ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.personal_best_global ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.record ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.record_media ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.record_statistic ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_point_contribution ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.vote ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.workshop_item ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.world_record_global ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.zsl_level ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.zsl_level_result ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY graphql_select_visible_favourite
	ON public.favourite
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_level(id_level));--> statement-breakpoint
CREATE POLICY graphql_select_visible_level
	ON public.level
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_level(id));--> statement-breakpoint
CREATE POLICY graphql_select_visible_level_item
	ON public.level_item
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_level_item(id));--> statement-breakpoint
CREATE POLICY graphql_select_visible_level_metadata
	ON public.level_metadata
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_level(id_level));--> statement-breakpoint
CREATE POLICY graphql_select_visible_level_points
	ON public.level_points
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_level(id_level));--> statement-breakpoint
CREATE POLICY graphql_select_visible_level_points_history
	ON public.level_points_history
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_level(id_level));--> statement-breakpoint
CREATE POLICY graphql_select_visible_personal_best
	ON public.personal_best_global
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (
		zc_private.is_visible_level(id_level)
		AND zc_private.is_visible_record(id_record)
	);--> statement-breakpoint
CREATE POLICY graphql_select_visible_record
	ON public.record
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_level(id_level));--> statement-breakpoint
CREATE POLICY graphql_select_visible_record_media
	ON public.record_media
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_record(id_record));--> statement-breakpoint
CREATE POLICY graphql_select_visible_record_statistic
	ON public.record_statistic
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_record(id_record));--> statement-breakpoint
CREATE POLICY graphql_select_visible_user_point_contribution
	ON public.user_point_contribution
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (
		zc_private.is_visible_level(id_level)
		AND zc_private.is_visible_record(id_record)
	);--> statement-breakpoint
CREATE POLICY graphql_select_visible_vote
	ON public.vote
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_level(id_level));--> statement-breakpoint
CREATE POLICY graphql_select_visible_workshop_item
	ON public.workshop_item
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_workshop_item(workshop_id));--> statement-breakpoint
CREATE POLICY graphql_select_visible_world_record
	ON public.world_record_global
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (
		zc_private.is_visible_level(id_level)
		AND zc_private.is_visible_record(id_record)
	);--> statement-breakpoint
CREATE POLICY graphql_select_visible_zsl_level
	ON public.zsl_level
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_zsl_level(id));--> statement-breakpoint
CREATE POLICY graphql_select_visible_zsl_level_result
	ON public.zsl_level_result
	AS PERMISSIVE
	FOR SELECT
	TO zeepcentraal_graphql
	USING (zc_private.is_visible_zsl_level(id_level));--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.hot_levels_since("since" timestamptz)
RETURNS SETOF public.level
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
	SELECT visible_level.*
	FROM public.level AS visible_level
	INNER JOIN public.record AS submitted_record
		ON submitted_record.id_level = visible_level.id
	WHERE submitted_record.date_created >= "since"
		AND zc_private.is_visible_level(visible_level.id)
	GROUP BY visible_level.id
	ORDER BY count(submitted_record.id) DESC, visible_level.id ASC;
$$;--> statement-breakpoint

DROP FUNCTION IF EXISTS public.z_rtm(
	real,
	real,
	integer,
	integer,
	integer[],
	text[],
	integer,
	integer,
	integer,
	integer,
	integer,
	integer,
	integer
);--> statement-breakpoint
DROP FUNCTION IF EXISTS public.z_rtm(
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
	integer
);--> statement-breakpoint

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
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
	RETURN QUERY
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
		COALESCE(record_counts.num_records, 0) AS num_records,
		visible_level_points.points
	FROM public.level_item AS visible_level_item
	LEFT JOIN public.level_points AS visible_level_points
		ON visible_level_item.id_level = visible_level_points.id_level
	LEFT JOIN public.level_metadata AS visible_level_metadata
		ON visible_level_item.id_level = visible_level_metadata.id_level
	LEFT JOIN LATERAL (
		SELECT count(*) AS num_records
		FROM public.record AS submitted_record
		WHERE submitted_record.id_level = visible_level_item.id_level
	) AS record_counts ON true
	INNER JOIN public.level AS visible_level
		ON visible_level_item.id_level = visible_level.id
	WHERE zc_private.is_visible_level_item(visible_level_item.id)
		AND (p_min_author_time IS NULL OR visible_level_item.validation_time_author >= p_min_author_time)
		AND (p_max_author_time IS NULL OR visible_level_item.validation_time_author <= p_max_author_time)
		AND (p_min_records IS NULL OR COALESCE(record_counts.num_records, 0) >= p_min_records)
		AND (p_max_records IS NULL OR COALESCE(record_counts.num_records, 0) <= p_max_records)
		AND (p_excluded_author_ids IS NULL OR visible_level_item.author_id <> ALL (p_excluded_author_ids))
		AND (p_excluded_hashes IS NULL OR visible_level.hash <> ALL (p_excluded_hashes))
		AND (p_min_checkpoints IS NULL OR visible_level_metadata.amount_checkpoints >= p_min_checkpoints)
		AND (p_max_checkpoints IS NULL OR visible_level_metadata.amount_checkpoints <= p_max_checkpoints)
		AND (p_min_finishes IS NULL OR visible_level_metadata.amount_finishes >= p_min_finishes)
		AND (p_max_finishes IS NULL OR visible_level_metadata.amount_finishes <= p_max_finishes)
		AND (p_min_blocks IS NULL OR visible_level_metadata.amount_blocks >= p_min_blocks)
		AND (p_max_blocks IS NULL OR visible_level_metadata.amount_blocks <= p_max_blocks)
		AND (p_min_points IS NULL OR visible_level_points.points >= p_min_points)
		AND (p_max_points IS NULL OR visible_level_points.points <= p_max_points)
	ORDER BY pg_catalog.random()
	LIMIT p_sample_size;
END;
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.hot_levels_since(timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.tg__live_query_invalidate() FROM PUBLIC;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.z_rtm(
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
) FROM PUBLIC;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;--> statement-breakpoint

REVOKE ALL ON SCHEMA public FROM zeepcentraal_graphql;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO zeepcentraal_graphql;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM zeepcentraal_graphql;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;--> statement-breakpoint
GRANT SELECT ON TABLE
	public.favourite,
	public.level,
	public.level_item,
	public.level_metadata,
	public.level_points,
	public.level_points_history,
	public.personal_best_global,
	public.record,
	public.record_media,
	public.record_statistic,
	public."user",
	public.user_point_contribution,
	public.user_points,
	public.user_points_history,
	public.version,
	public.vote,
	public.workshop_item,
	public.world_record_global,
	public.zsl_level,
	public.zsl_level_result,
	public.zsl_points_structure,
	public.zsl_round,
	public.zsl_round_result,
	public.zsl_season,
	public.zsl_season_result
TO zeepcentraal_graphql;--> statement-breakpoint
GRANT SELECT, DELETE ON TABLE public.live_query_invalidations TO zeepcentraal_graphql;--> statement-breakpoint
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
