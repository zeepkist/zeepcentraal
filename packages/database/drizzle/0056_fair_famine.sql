ALTER TABLE public.level ADD COLUMN has_records boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE public.level ADD COLUMN publicly_visible boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE public.level_item ADD COLUMN publicly_visible boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE public.level_metadata ADD COLUMN publicly_visible boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE public.workshop_item ADD COLUMN publicly_visible boolean DEFAULT false NOT NULL;--> statement-breakpoint

COMMENT ON COLUMN public.level.has_records IS E'@omit\n@behavior -aggregate -groupBy -havingBy';--> statement-breakpoint
COMMENT ON COLUMN public.level_item.publicly_visible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';--> statement-breakpoint
COMMENT ON COLUMN public.level_metadata.publicly_visible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';--> statement-breakpoint
COMMENT ON COLUMN public.workshop_item.publicly_visible IS E'@omit\n@behavior -aggregate -groupBy -havingBy';--> statement-breakpoint

LOCK TABLE
	public.level,
	public.level_item,
	public.level_metadata,
	public.workshop_item,
	public.record
IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint

DROP TRIGGER IF EXISTS graphql_sync_record_visibility_insert_delete ON public.record;--> statement-breakpoint
DROP TRIGGER IF EXISTS graphql_sync_record_visibility_level_update ON public.record;--> statement-breakpoint
DROP TRIGGER IF EXISTS graphql_sync_level_visibility_insert_delete ON public.level;--> statement-breakpoint
DROP TRIGGER IF EXISTS graphql_sync_level_visibility_adventure_update ON public.level;--> statement-breakpoint
DROP TRIGGER IF EXISTS graphql_sync_level_item_visibility_insert_delete ON public.level_item;--> statement-breakpoint
DROP TRIGGER IF EXISTS graphql_sync_level_item_visibility_update ON public.level_item;--> statement-breakpoint
DROP TRIGGER IF EXISTS graphql_sync_workshop_visibility_insert_delete ON public.workshop_item;--> statement-breakpoint
DROP TRIGGER IF EXISTS graphql_sync_workshop_visibility_update ON public.workshop_item;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.tg__live_query_invalidate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	INSERT INTO public.live_query_invalidations (schema_name, table_name, operation)
	VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP);

	RETURN NULL;
END;
$$;--> statement-breakpoint

-- Older Workshop refreshes could demote official Adventure levels. Migration 0030 created one
-- authoritative synthetic alias per official level with this Workshop/author pair.
UPDATE public.level AS candidate_level
SET
	adventure = true,
	date_updated = now()
WHERE candidate_level.adventure = false
	AND EXISTS (
		SELECT 1
		FROM public.level_item AS official_adventure_item
		WHERE official_adventure_item.id_level = candidate_level.id
			AND official_adventure_item.workshop_id = -1
			AND official_adventure_item.author_id = 76561198041027402
	);--> statement-breakpoint

UPDATE public.level AS candidate_level
SET has_records = EXISTS (
	SELECT 1
	FROM public.record AS submitted_record
	WHERE submitted_record.id_level = candidate_level.id
);--> statement-breakpoint

UPDATE public.level_item AS candidate_level_item
SET publicly_visible =
	candidate_level.adventure = true
	OR (
		candidate_level_item.deleted = false
		AND (
			candidate_workshop_item.visibility = 0
			OR (
				candidate_workshop_item.visibility = 3
				AND candidate_level.has_records = true
			)
		)
	)
FROM public.level AS candidate_level, public.workshop_item AS candidate_workshop_item
WHERE candidate_level.id = candidate_level_item.id_level
	AND candidate_workshop_item.workshop_id = candidate_level_item.workshop_id;--> statement-breakpoint

UPDATE public.workshop_item AS candidate_workshop_item
SET publicly_visible =
	candidate_workshop_item.visibility = 0
	OR EXISTS (
		SELECT 1
		FROM public.level_item AS visible_level_item
		WHERE visible_level_item.workshop_id = candidate_workshop_item.workshop_id
			AND visible_level_item.publicly_visible = true
	);--> statement-breakpoint

UPDATE public.level AS candidate_level
SET publicly_visible =
	candidate_level.adventure = true
	OR EXISTS (
		SELECT 1
		FROM public.level_item AS visible_level_item
		WHERE visible_level_item.id_level = candidate_level.id
			AND visible_level_item.publicly_visible = true
	);--> statement-breakpoint

UPDATE public.level_metadata AS candidate_level_metadata
SET publicly_visible = candidate_level.publicly_visible
FROM public.level AS candidate_level
WHERE candidate_level.id = candidate_level_metadata.id_level;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.sync_public_workshop_visibility(p_workshop_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF p_workshop_id IS NULL THEN
		RETURN;
	END IF;

	UPDATE public.workshop_item AS candidate_workshop_item
	SET publicly_visible =
		candidate_workshop_item.visibility = 0
		OR EXISTS (
			SELECT 1
			FROM public.level_item AS visible_level_item
			WHERE visible_level_item.workshop_id = candidate_workshop_item.workshop_id
				AND visible_level_item.publicly_visible = true
		)
	WHERE candidate_workshop_item.workshop_id = p_workshop_id
		AND candidate_workshop_item.publicly_visible IS DISTINCT FROM (
			candidate_workshop_item.visibility = 0
			OR EXISTS (
				SELECT 1
				FROM public.level_item AS visible_level_item
				WHERE visible_level_item.workshop_id = candidate_workshop_item.workshop_id
					AND visible_level_item.publicly_visible = true
			)
		);
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.sync_public_workshop_visibility(bigint) OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.sync_public_workshop_visibility(bigint) FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.sync_public_level_summary(p_level_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF p_level_id IS NULL THEN
		RETURN;
	END IF;

	-- A summary can be refreshed by different Workshop aliases concurrently. Lock even when the
	-- derived value will not change so the next transaction evaluates all aliases after this one
	-- commits, rather than both keeping a stale public value from their statement snapshots.
	PERFORM candidate_level.id
	FROM public.level AS candidate_level
	WHERE candidate_level.id = p_level_id
	FOR UPDATE OF candidate_level;

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

CREATE OR REPLACE FUNCTION zc_private.sync_public_level_visibility(p_level_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	affected_workshop_id bigint;
BEGIN
	IF p_level_id IS NULL THEN
		RETURN;
	END IF;

	UPDATE public.level_item AS candidate_level_item
	SET publicly_visible =
		candidate_level.adventure = true
		OR (
			candidate_level_item.deleted = false
			AND (
				candidate_workshop_item.visibility = 0
				OR (
					candidate_workshop_item.visibility = 3
					AND candidate_level.has_records = true
				)
			)
		)
	FROM public.level AS candidate_level, public.workshop_item AS candidate_workshop_item
	WHERE candidate_level_item.id_level = p_level_id
		AND candidate_level.id = candidate_level_item.id_level
		AND candidate_workshop_item.workshop_id = candidate_level_item.workshop_id
		AND candidate_level_item.publicly_visible IS DISTINCT FROM (
			candidate_level.adventure = true
			OR (
				candidate_level_item.deleted = false
				AND (
					candidate_workshop_item.visibility = 0
					OR (
						candidate_workshop_item.visibility = 3
						AND candidate_level.has_records = true
					)
				)
			)
		);

	PERFORM zc_private.sync_public_level_summary(p_level_id);

	FOR affected_workshop_id IN
		SELECT DISTINCT candidate_level_item.workshop_id
		FROM public.level_item AS candidate_level_item
		WHERE candidate_level_item.id_level = p_level_id
		ORDER BY candidate_level_item.workshop_id
	LOOP
		PERFORM zc_private.sync_public_workshop_visibility(affected_workshop_id);
	END LOOP;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.sync_public_level_visibility(integer) OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.sync_public_level_visibility(integer) FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_mark_level_has_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM public.level AS candidate_level
		WHERE candidate_level.id = NEW.id_level
			AND candidate_level.has_records = true
	) THEN
		RETURN NEW;
	END IF;

	PERFORM candidate_workshop_item.workshop_id
	FROM public.workshop_item AS candidate_workshop_item
	INNER JOIN public.level_item AS candidate_level_item
		ON candidate_level_item.workshop_id = candidate_workshop_item.workshop_id
	WHERE candidate_level_item.id_level = NEW.id_level
	ORDER BY candidate_workshop_item.workshop_id
	FOR UPDATE OF candidate_workshop_item;

	UPDATE public.level
	SET has_records = true
	WHERE id = NEW.id_level
		AND has_records = false;

	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_mark_level_has_records() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_mark_level_has_records() FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_public_level_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM zc_private.sync_public_level_visibility(NEW.id);
	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_public_level_visibility() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_public_level_visibility() FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_set_public_level_item_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	NEW.publicly_visible := COALESCE((
		SELECT
			candidate_level.adventure = true
			OR (
				NEW.deleted = false
				AND (
					candidate_workshop_item.visibility = 0
					OR (
						candidate_workshop_item.visibility = 3
						AND candidate_level.has_records = true
					)
				)
			)
		FROM public.level AS candidate_level, public.workshop_item AS candidate_workshop_item
		WHERE candidate_level.id = NEW.id_level
			AND candidate_workshop_item.workshop_id = NEW.workshop_id
	), false);

	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_set_public_level_item_visibility() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_set_public_level_item_visibility() FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_public_level_item_parents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	first_level_id integer;
	second_level_id integer;
	first_workshop_id bigint;
	second_workshop_id bigint;
BEGIN
	IF TG_OP = 'INSERT' THEN
		PERFORM zc_private.sync_public_level_summary(NEW.id_level);
		PERFORM zc_private.sync_public_workshop_visibility(NEW.workshop_id);
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		PERFORM zc_private.sync_public_level_summary(OLD.id_level);
		PERFORM zc_private.sync_public_workshop_visibility(OLD.workshop_id);
		RETURN OLD;
	END IF;

	first_level_id := LEAST(OLD.id_level, NEW.id_level);
	second_level_id := GREATEST(OLD.id_level, NEW.id_level);
	PERFORM zc_private.sync_public_level_summary(first_level_id);
	IF second_level_id <> first_level_id THEN
		PERFORM zc_private.sync_public_level_summary(second_level_id);
	END IF;

	first_workshop_id := LEAST(OLD.workshop_id, NEW.workshop_id);
	second_workshop_id := GREATEST(OLD.workshop_id, NEW.workshop_id);
	PERFORM zc_private.sync_public_workshop_visibility(first_workshop_id);
	IF second_workshop_id <> first_workshop_id THEN
		PERFORM zc_private.sync_public_workshop_visibility(second_workshop_id);
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_public_level_item_parents() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_public_level_item_parents() FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_public_workshop_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	-- Two Workshop items may alias the same Level. Serialize their visibility changes by locking
	-- every affected Level in one deterministic order before either alias or summary is recomputed.
	-- Each Workshop transaction already owns only its own Workshop row, so this does not introduce
	-- cross-Workshop lock ordering.
	PERFORM candidate_level.id
	FROM public.level AS candidate_level
	WHERE EXISTS (
		SELECT 1
		FROM public.level_item AS workshop_level_item
		WHERE workshop_level_item.id_level = candidate_level.id
			AND workshop_level_item.workshop_id = NEW.workshop_id
	)
	ORDER BY candidate_level.id
	FOR UPDATE OF candidate_level;

	UPDATE public.level_item AS candidate_level_item
	SET publicly_visible =
		candidate_level.adventure = true
		OR (
			candidate_level_item.deleted = false
			AND (
				NEW.visibility = 0
				OR (
					NEW.visibility = 3
					AND candidate_level.has_records = true
				)
			)
		)
	FROM public.level AS candidate_level
	WHERE candidate_level_item.workshop_id = NEW.workshop_id
		AND candidate_level.id = candidate_level_item.id_level
		AND candidate_level_item.publicly_visible IS DISTINCT FROM (
			candidate_level.adventure = true
			OR (
				candidate_level_item.deleted = false
				AND (
					NEW.visibility = 0
					OR (
						NEW.visibility = 3
						AND candidate_level.has_records = true
					)
				)
			)
		);

	UPDATE public.level AS candidate_level
	SET publicly_visible =
		candidate_level.adventure = true
		OR EXISTS (
			SELECT 1
			FROM public.level_item AS visible_level_item
			WHERE visible_level_item.id_level = candidate_level.id
				AND visible_level_item.publicly_visible = true
		)
	WHERE EXISTS (
			SELECT 1
			FROM public.level_item AS workshop_level_item
			WHERE workshop_level_item.id_level = candidate_level.id
				AND workshop_level_item.workshop_id = NEW.workshop_id
		)
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
	WHERE candidate_level.id = candidate_level_metadata.id_level
		AND EXISTS (
			SELECT 1
			FROM public.level_item AS workshop_level_item
			WHERE workshop_level_item.id_level = candidate_level.id
				AND workshop_level_item.workshop_id = NEW.workshop_id
		)
		AND candidate_level_metadata.publicly_visible IS DISTINCT FROM candidate_level.publicly_visible;

	PERFORM zc_private.sync_public_workshop_visibility(NEW.workshop_id);
	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_public_workshop_visibility() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_public_workshop_visibility() FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_set_public_level_metadata_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	SELECT candidate_level.publicly_visible
	INTO NEW.publicly_visible
	FROM public.level AS candidate_level
	WHERE candidate_level.id = NEW.id_level;

	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_set_public_level_metadata_visibility() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_set_public_level_metadata_visibility() FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint

CREATE TRIGGER graphql_mark_level_has_records_insert
	AFTER INSERT ON public.record
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_mark_level_has_records();--> statement-breakpoint
CREATE TRIGGER graphql_mark_level_has_records_level_update
	AFTER UPDATE OF id_level ON public.record
	FOR EACH ROW
	WHEN (OLD.id_level IS DISTINCT FROM NEW.id_level)
	EXECUTE FUNCTION zc_private.tg_mark_level_has_records();--> statement-breakpoint
CREATE TRIGGER graphql_sync_public_level_visibility_insert
	AFTER INSERT ON public.level
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_public_level_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_sync_public_level_visibility_update
	AFTER UPDATE OF adventure, has_records ON public.level
	FOR EACH ROW
	WHEN (
		OLD.adventure IS DISTINCT FROM NEW.adventure
		OR OLD.has_records IS DISTINCT FROM NEW.has_records
	)
	EXECUTE FUNCTION zc_private.tg_sync_public_level_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_set_public_level_item_visibility
	BEFORE INSERT OR UPDATE OF id_level, workshop_id, deleted ON public.level_item
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_set_public_level_item_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_sync_public_level_item_parents_insert_delete
	AFTER INSERT OR DELETE ON public.level_item
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_public_level_item_parents();--> statement-breakpoint
CREATE TRIGGER graphql_sync_public_level_item_parents_update
	AFTER UPDATE OF id_level, workshop_id, deleted ON public.level_item
	FOR EACH ROW
	WHEN (
		OLD.id_level IS DISTINCT FROM NEW.id_level
		OR OLD.workshop_id IS DISTINCT FROM NEW.workshop_id
		OR OLD.deleted IS DISTINCT FROM NEW.deleted
	)
	EXECUTE FUNCTION zc_private.tg_sync_public_level_item_parents();--> statement-breakpoint
CREATE TRIGGER graphql_sync_public_workshop_visibility_insert
	AFTER INSERT ON public.workshop_item
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_public_workshop_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_sync_public_workshop_visibility_update
	AFTER UPDATE OF visibility ON public.workshop_item
	FOR EACH ROW
	WHEN (OLD.visibility IS DISTINCT FROM NEW.visibility)
	EXECUTE FUNCTION zc_private.tg_sync_public_workshop_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_set_public_level_metadata_visibility
	BEFORE INSERT OR UPDATE OF id_level ON public.level_metadata
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_set_public_level_metadata_visibility();--> statement-breakpoint

DROP POLICY graphql_select_visible_favourite ON public.favourite;--> statement-breakpoint
ALTER TABLE public.favourite DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_level ON public.level;--> statement-breakpoint
ALTER TABLE public.level DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_level_points ON public.level_points;--> statement-breakpoint
ALTER TABLE public.level_points DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_level_points_history ON public.level_points_history;--> statement-breakpoint
ALTER TABLE public.level_points_history DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_personal_best ON public.personal_best_global;--> statement-breakpoint
ALTER TABLE public.personal_best_global DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_record ON public.record;--> statement-breakpoint
ALTER TABLE public.record DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_record_media ON public.record_media;--> statement-breakpoint
ALTER TABLE public.record_media DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_record_statistic ON public.record_statistic;--> statement-breakpoint
ALTER TABLE public.record_statistic DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_user_point_contribution ON public.user_point_contribution;--> statement-breakpoint
ALTER TABLE public.user_point_contribution DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_vote ON public.vote;--> statement-breakpoint
ALTER TABLE public.vote DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_world_record ON public.world_record_global;--> statement-breakpoint
ALTER TABLE public.world_record_global DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_zsl_level ON public.zsl_level;--> statement-breakpoint
ALTER TABLE public.zsl_level DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY graphql_select_visible_zsl_level_result ON public.zsl_level_result;--> statement-breakpoint
ALTER TABLE public.zsl_level_result DISABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER POLICY graphql_select_visible_level_item
	ON public.level_item
	TO zeepcentraal_graphql
	USING (publicly_visible = true);--> statement-breakpoint
ALTER POLICY graphql_select_visible_level_metadata
	ON public.level_metadata
	TO zeepcentraal_graphql
	USING (publicly_visible = true);--> statement-breakpoint
ALTER POLICY graphql_select_visible_workshop_item
	ON public.workshop_item
	TO zeepcentraal_graphql
	USING (publicly_visible = true);--> statement-breakpoint

CREATE INDEX "IX_level_publicly_visible_id" ON public.level USING btree (id) WHERE publicly_visible = true;--> statement-breakpoint
CREATE INDEX "IX_level_item_public_level_updated" ON public.level_item USING btree (id_level, updated_at DESC NULLS LAST, id DESC NULLS LAST) WHERE publicly_visible = true;--> statement-breakpoint
CREATE INDEX "IX_level_item_public_workshop" ON public.level_item USING btree (workshop_id, id) WHERE publicly_visible = true;--> statement-breakpoint
CREATE INDEX "IX_level_metadata_public_level" ON public.level_metadata USING btree (id_level) WHERE publicly_visible = true;--> statement-breakpoint
CREATE INDEX "IX_workshop_item_public" ON public.workshop_item USING btree (workshop_id) WHERE publicly_visible = true;--> statement-breakpoint

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
	WHERE visible_level.publicly_visible = true
		AND submitted_record.date_created >= "since"
	GROUP BY visible_level.id
	ORDER BY count(submitted_record.id) DESC, visible_level.id ASC;
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
	WHERE visible_level_item.publicly_visible = true
		AND visible_level_item.deleted = false
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

DROP VIEW IF EXISTS zc_private.visible_record;--> statement-breakpoint
DROP VIEW IF EXISTS zc_private.visible_zsl_level;--> statement-breakpoint

DROP FUNCTION IF EXISTS zc_private.is_visible_level(integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.is_visible_level_item(integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.is_visible_workshop_item(bigint);--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.is_visible_record(integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.is_visible_zsl_level(integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.tg_sync_record_visibility();--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.tg_sync_level_visibility();--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.tg_sync_level_item_visibility();--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.tg_sync_workshop_visibility();--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.sync_level_visibility(integer);--> statement-breakpoint
DROP FUNCTION IF EXISTS zc_private.sync_workshop_visibility(bigint);--> statement-breakpoint

DROP TABLE IF EXISTS zc_private.level_record_count;--> statement-breakpoint
DROP TABLE IF EXISTS zc_private.visible_level;--> statement-breakpoint
DROP TABLE IF EXISTS zc_private.visible_level_item;--> statement-breakpoint
DROP TABLE IF EXISTS zc_private.visible_workshop_item;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.hot_levels_since(timestamptz) FROM PUBLIC;--> statement-breakpoint
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
