CREATE TABLE "zc_private"."level_record_count" (
	"id_level" integer PRIMARY KEY NOT NULL,
	"record_count" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."visible_level" (
	"id_level" integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."visible_level_item" (
	"id_level_item" integer PRIMARY KEY NOT NULL,
	"id_level" integer NOT NULL,
	"workshop_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zc_private"."visible_workshop_item" (
	"workshop_id" bigint PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zc_private"."level_record_count" ADD CONSTRAINT "graphql_level_record_count_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."visible_level" ADD CONSTRAINT "graphql_visible_level_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."visible_level_item" ADD CONSTRAINT "graphql_visible_level_item_item_fkey" FOREIGN KEY ("id_level_item") REFERENCES "public"."level_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."visible_level_item" ADD CONSTRAINT "graphql_visible_level_item_level_fkey" FOREIGN KEY ("id_level") REFERENCES "public"."level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."visible_level_item" ADD CONSTRAINT "graphql_visible_level_item_workshop_fkey" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop_item"("workshop_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zc_private"."visible_workshop_item" ADD CONSTRAINT "graphql_visible_workshop_item_workshop_fkey" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshop_item"("workshop_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_graphql_visible_level_item_level" ON "zc_private"."visible_level_item" USING btree ("id_level");--> statement-breakpoint
CREATE INDEX "IX_graphql_visible_level_item_workshop" ON "zc_private"."visible_level_item" USING btree ("workshop_id");--> statement-breakpoint

-- Build a transactionally consistent visibility snapshot before replacing the policies. The
-- record counter contains only levels with records; absence therefore means zero records.
INSERT INTO zc_private.level_record_count (id_level, record_count)
SELECT submitted_record.id_level, count(*)
FROM public.record AS submitted_record
GROUP BY submitted_record.id_level;--> statement-breakpoint

INSERT INTO zc_private.visible_level_item (id_level_item, id_level, workshop_id)
SELECT candidate_level_item.id, candidate_level_item.id_level, candidate_level_item.workshop_id
FROM public.level_item AS candidate_level_item
INNER JOIN public.workshop_item AS candidate_workshop_item
	ON candidate_workshop_item.workshop_id = candidate_level_item.workshop_id
LEFT JOIN zc_private.level_record_count AS level_records
	ON level_records.id_level = candidate_level_item.id_level
WHERE candidate_level_item.deleted = false
	AND (
		candidate_workshop_item.visibility = 0
		OR (
			candidate_workshop_item.visibility = 3
			AND COALESCE(level_records.record_count, 0) > 0
		)
	);--> statement-breakpoint

INSERT INTO zc_private.visible_level (id_level)
SELECT candidate_level.id
FROM public.level AS candidate_level
WHERE candidate_level.adventure = true
	OR NOT EXISTS (
		SELECT 1
		FROM public.level_item AS any_level_item
		WHERE any_level_item.id_level = candidate_level.id
	)
	OR EXISTS (
		SELECT 1
		FROM zc_private.visible_level_item AS visible_level_item
		WHERE visible_level_item.id_level = candidate_level.id
	);--> statement-breakpoint

INSERT INTO zc_private.visible_workshop_item (workshop_id)
SELECT DISTINCT visible_level_item.workshop_id
FROM zc_private.visible_level_item AS visible_level_item;--> statement-breakpoint

CREATE VIEW "zc_private"."visible_record" WITH (security_barrier = true) AS (
		SELECT visible_record.id AS id_record, visible_record.id_level
		FROM public.record AS visible_record
		INNER JOIN zc_private.visible_level AS visible_level
			ON visible_level.id_level = visible_record.id_level
	);--> statement-breakpoint
CREATE VIEW "zc_private"."visible_zsl_level" WITH (security_barrier = true) AS (
		SELECT visible_zsl_level.id AS id_zsl_level, visible_zsl_level.id_level
		FROM public.zsl_level AS visible_zsl_level
		INNER JOIN zc_private.visible_level AS visible_level
			ON visible_level.id_level = visible_zsl_level.id_level
	);--> statement-breakpoint
ALTER POLICY "graphql_select_visible_favourite" ON "favourite" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "favourite"."id_level"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_level" ON "level" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "level"."id"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_level_item" ON "level_item" TO zeepcentraal_graphql USING (EXISTS (
				SELECT 1
				FROM zc_private.visible_level_item AS graphql_visible_level_item
				WHERE graphql_visible_level_item.id_level_item = "level_item"."id"
			));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_level_metadata" ON "level_metadata" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "level_metadata"."id_level"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_level_points" ON "level_points" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "level_points"."id_level"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_level_points_history" ON "level_points_history" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "level_points_history"."id_level"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_personal_best" ON "personal_best_global" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "personal_best_global"."id_level"
) AND EXISTS (
	SELECT 1
	FROM zc_private.visible_record AS graphql_visible_record
	WHERE graphql_visible_record.id_record = "personal_best_global"."id_record"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_record" ON "record" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "record"."id_level"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_record_media" ON "record_media" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_record AS graphql_visible_record
	WHERE graphql_visible_record.id_record = "record_media"."id_record"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_record_statistic" ON "record_statistic" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_record AS graphql_visible_record
	WHERE graphql_visible_record.id_record = "record_statistic"."id_record"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_user_point_contribution" ON "user_point_contribution" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "user_point_contribution"."id_level"
) AND EXISTS (
	SELECT 1
	FROM zc_private.visible_record AS graphql_visible_record
	WHERE graphql_visible_record.id_record = "user_point_contribution"."id_record"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_vote" ON "vote" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "vote"."id_level"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_workshop_item" ON "workshop_item" TO zeepcentraal_graphql USING (EXISTS (
				SELECT 1
				FROM zc_private.visible_workshop_item AS graphql_visible_workshop_item
				WHERE graphql_visible_workshop_item.workshop_id = "workshop_item"."workshop_id"
			));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_world_record" ON "world_record_global" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_level AS graphql_visible_level
	WHERE graphql_visible_level.id_level = "world_record_global"."id_level"
) AND EXISTS (
	SELECT 1
	FROM zc_private.visible_record AS graphql_visible_record
	WHERE graphql_visible_record.id_record = "world_record_global"."id_record"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_zsl_level" ON "zsl_level" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_zsl_level AS graphql_visible_zsl_level
	WHERE graphql_visible_zsl_level.id_zsl_level = "zsl_level"."id"
));--> statement-breakpoint
ALTER POLICY "graphql_select_visible_zsl_level_result" ON "zsl_level_result" TO zeepcentraal_graphql USING (EXISTS (
	SELECT 1
	FROM zc_private.visible_zsl_level AS graphql_visible_zsl_level
	WHERE graphql_visible_zsl_level.id_zsl_level = "zsl_level_result"."id_level"
));
--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.sync_workshop_visibility(p_workshop_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF p_workshop_id IS NULL THEN
		RETURN;
	END IF;

	DELETE FROM zc_private.visible_workshop_item
	WHERE workshop_id = p_workshop_id;

	INSERT INTO zc_private.visible_workshop_item (workshop_id)
	SELECT p_workshop_id
	WHERE EXISTS (
		SELECT 1
		FROM zc_private.visible_level_item AS visible_level_item
		WHERE visible_level_item.workshop_id = p_workshop_id
	)
	ON CONFLICT (workshop_id) DO NOTHING;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.sync_workshop_visibility(bigint) OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.sync_level_visibility(p_level_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	affected_workshop_ids bigint[];
	affected_workshop_id bigint;
BEGIN
	IF p_level_id IS NULL THEN
		RETURN;
	END IF;

	SELECT array_agg(affected_workshop.workshop_id ORDER BY affected_workshop.workshop_id)
	INTO affected_workshop_ids
	FROM (
		SELECT current_level_item.workshop_id
		FROM public.level_item AS current_level_item
		WHERE current_level_item.id_level = p_level_id
		UNION
		SELECT previous_level_item.workshop_id
		FROM zc_private.visible_level_item AS previous_level_item
		WHERE previous_level_item.id_level = p_level_id
	) AS affected_workshop;

	DELETE FROM zc_private.visible_level_item
	WHERE id_level = p_level_id;

	INSERT INTO zc_private.visible_level_item (id_level_item, id_level, workshop_id)
	SELECT candidate_level_item.id, candidate_level_item.id_level, candidate_level_item.workshop_id
	FROM public.level_item AS candidate_level_item
	INNER JOIN public.workshop_item AS candidate_workshop_item
		ON candidate_workshop_item.workshop_id = candidate_level_item.workshop_id
	LEFT JOIN zc_private.level_record_count AS level_records
		ON level_records.id_level = candidate_level_item.id_level
	WHERE candidate_level_item.id_level = p_level_id
		AND candidate_level_item.deleted = false
		AND (
			candidate_workshop_item.visibility = 0
			OR (
				candidate_workshop_item.visibility = 3
				AND COALESCE(level_records.record_count, 0) > 0
			)
		)
	ON CONFLICT (id_level_item) DO UPDATE
	SET
		id_level = EXCLUDED.id_level,
		workshop_id = EXCLUDED.workshop_id;

	DELETE FROM zc_private.visible_level
	WHERE id_level = p_level_id;

	INSERT INTO zc_private.visible_level (id_level)
	SELECT candidate_level.id
	FROM public.level AS candidate_level
	WHERE candidate_level.id = p_level_id
		AND (
			candidate_level.adventure = true
			OR NOT EXISTS (
				SELECT 1
				FROM public.level_item AS any_level_item
				WHERE any_level_item.id_level = candidate_level.id
			)
			OR EXISTS (
				SELECT 1
				FROM zc_private.visible_level_item AS visible_level_item
				WHERE visible_level_item.id_level = candidate_level.id
			)
		)
	ON CONFLICT (id_level) DO NOTHING;

	IF affected_workshop_ids IS NOT NULL THEN
		FOREACH affected_workshop_id IN ARRAY affected_workshop_ids
		LOOP
			PERFORM zc_private.sync_workshop_visibility(affected_workshop_id);
		END LOOP;
	END IF;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.sync_level_visibility(integer) OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	old_visibility_changed boolean := false;
	new_visibility_changed boolean := false;
	new_record_count bigint;
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO zc_private.level_record_count (id_level, record_count)
		VALUES (NEW.id_level, 1)
		ON CONFLICT (id_level) DO UPDATE
		SET record_count = zc_private.level_record_count.record_count + 1
		RETURNING record_count INTO new_record_count;

		IF new_record_count = 1 THEN
			PERFORM zc_private.sync_level_visibility(NEW.id_level);
		END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		DELETE FROM zc_private.level_record_count
		WHERE id_level = OLD.id_level
			AND record_count = 1;

		IF FOUND THEN
			PERFORM zc_private.sync_level_visibility(OLD.id_level);
		ELSE
			UPDATE zc_private.level_record_count
			SET record_count = record_count - 1
			WHERE id_level = OLD.id_level
				AND record_count > 1;
		END IF;

		RETURN OLD;
	END IF;

	IF OLD.id_level = NEW.id_level THEN
		RETURN NEW;
	END IF;

	DELETE FROM zc_private.level_record_count
	WHERE id_level = OLD.id_level
		AND record_count = 1;

	old_visibility_changed := FOUND;
	IF NOT old_visibility_changed THEN
		UPDATE zc_private.level_record_count
		SET record_count = record_count - 1
		WHERE id_level = OLD.id_level
			AND record_count > 1;
	END IF;

	INSERT INTO zc_private.level_record_count (id_level, record_count)
	VALUES (NEW.id_level, 1)
	ON CONFLICT (id_level) DO UPDATE
	SET record_count = zc_private.level_record_count.record_count + 1
	RETURNING record_count INTO new_record_count;
	new_visibility_changed := new_record_count = 1;

	IF old_visibility_changed OR new_visibility_changed THEN
		IF OLD.id_level < NEW.id_level THEN
			IF old_visibility_changed THEN
				PERFORM zc_private.sync_level_visibility(OLD.id_level);
			END IF;
			IF new_visibility_changed THEN
				PERFORM zc_private.sync_level_visibility(NEW.id_level);
			END IF;
		ELSE
			IF new_visibility_changed THEN
				PERFORM zc_private.sync_level_visibility(NEW.id_level);
			END IF;
			IF old_visibility_changed THEN
				PERFORM zc_private.sync_level_visibility(OLD.id_level);
			END IF;
		END IF;
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_visibility() OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_level_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM zc_private.sync_level_visibility(OLD.id);
		RETURN OLD;
	END IF;

	PERFORM zc_private.sync_level_visibility(NEW.id);
	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_level_visibility() OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_level_item_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	first_level_id integer;
	second_level_id integer;
BEGIN
	IF TG_OP = 'INSERT' THEN
		PERFORM zc_private.sync_level_visibility(NEW.id_level);
		PERFORM zc_private.sync_workshop_visibility(NEW.workshop_id);
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		PERFORM zc_private.sync_level_visibility(OLD.id_level);
		PERFORM zc_private.sync_workshop_visibility(OLD.workshop_id);
		RETURN OLD;
	END IF;

	first_level_id := LEAST(OLD.id_level, NEW.id_level);
	second_level_id := GREATEST(OLD.id_level, NEW.id_level);
	PERFORM zc_private.sync_level_visibility(first_level_id);
	IF second_level_id <> first_level_id THEN
		PERFORM zc_private.sync_level_visibility(second_level_id);
	END IF;
	PERFORM zc_private.sync_workshop_visibility(OLD.workshop_id);
	IF NEW.workshop_id <> OLD.workshop_id THEN
		PERFORM zc_private.sync_workshop_visibility(NEW.workshop_id);
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_level_item_visibility() OWNER TO CURRENT_USER;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_workshop_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	affected_workshop_id bigint;
	affected_level_id integer;
BEGIN
	affected_workshop_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.workshop_id ELSE NEW.workshop_id END;

	FOR affected_level_id IN
		SELECT related_level.id_level
		FROM (
			SELECT current_level_item.id_level
			FROM public.level_item AS current_level_item
			WHERE current_level_item.workshop_id = affected_workshop_id
			UNION
			SELECT previous_level_item.id_level
			FROM zc_private.visible_level_item AS previous_level_item
			WHERE previous_level_item.workshop_id = affected_workshop_id
		) AS related_level
		ORDER BY related_level.id_level
	LOOP
		PERFORM zc_private.sync_level_visibility(affected_level_id);
	END LOOP;

	PERFORM zc_private.sync_workshop_visibility(affected_workshop_id);
	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_workshop_visibility() OWNER TO CURRENT_USER;--> statement-breakpoint

DROP TRIGGER IF EXISTS graphql_sync_record_visibility ON public.record;--> statement-breakpoint
CREATE TRIGGER graphql_sync_record_visibility_insert_delete
	AFTER INSERT OR DELETE ON public.record
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_record_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_sync_record_visibility_level_update
	AFTER UPDATE OF id_level ON public.record
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_record_visibility();--> statement-breakpoint

DROP TRIGGER IF EXISTS graphql_sync_level_visibility ON public.level;--> statement-breakpoint
CREATE TRIGGER graphql_sync_level_visibility_insert_delete
	AFTER INSERT OR DELETE ON public.level
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_level_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_sync_level_visibility_adventure_update
	AFTER UPDATE OF adventure ON public.level
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_level_visibility();--> statement-breakpoint

DROP TRIGGER IF EXISTS graphql_sync_level_item_visibility ON public.level_item;--> statement-breakpoint
CREATE TRIGGER graphql_sync_level_item_visibility_insert_delete
	AFTER INSERT OR DELETE ON public.level_item
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_level_item_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_sync_level_item_visibility_update
	AFTER UPDATE OF id_level, workshop_id, deleted ON public.level_item
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_level_item_visibility();--> statement-breakpoint

DROP TRIGGER IF EXISTS graphql_sync_workshop_visibility ON public.workshop_item;--> statement-breakpoint
CREATE TRIGGER graphql_sync_workshop_visibility_insert_delete
	AFTER INSERT OR DELETE ON public.workshop_item
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_workshop_visibility();--> statement-breakpoint
CREATE TRIGGER graphql_sync_workshop_visibility_update
	AFTER UPDATE OF visibility ON public.workshop_item
	FOR EACH ROW
	EXECUTE FUNCTION zc_private.tg_sync_workshop_visibility();--> statement-breakpoint

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
		FROM zc_private.visible_level AS visible_level
		WHERE visible_level.id_level = p_level_id
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
		FROM zc_private.visible_level_item AS visible_level_item
		WHERE visible_level_item.id_level_item = p_level_item_id
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
		FROM zc_private.visible_workshop_item AS visible_workshop_item
		WHERE visible_workshop_item.workshop_id = p_workshop_id
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
		FROM zc_private.visible_record AS visible_record
		WHERE visible_record.id_record = p_record_id
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
		FROM zc_private.visible_zsl_level AS visible_zsl_level
		WHERE visible_zsl_level.id_zsl_level = p_zsl_level_id
	);
$$;--> statement-breakpoint
ALTER FUNCTION zc_private.is_visible_zsl_level(integer) OWNER TO CURRENT_USER;--> statement-breakpoint

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
	INNER JOIN zc_private.visible_level AS allowed_level
		ON allowed_level.id_level = visible_level.id
	INNER JOIN public.record AS submitted_record
		ON submitted_record.id_level = visible_level.id
	WHERE submitted_record.date_created >= "since"
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
	INNER JOIN zc_private.visible_level_item AS allowed_level_item
		ON allowed_level_item.id_level_item = visible_level_item.id
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
	WHERE (p_min_author_time IS NULL OR visible_level_item.validation_time_author >= p_min_author_time)
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

REVOKE ALL ON ALL TABLES IN SCHEMA zc_private FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA zc_private FROM zeepcentraal_graphql;--> statement-breakpoint
GRANT SELECT ON TABLE
	zc_private.visible_level,
	zc_private.visible_level_item,
	zc_private.visible_workshop_item,
	zc_private.visible_record,
	zc_private.visible_zsl_level
TO zeepcentraal_graphql;--> statement-breakpoint

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA zc_private FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA zc_private FROM zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_level(integer) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_level_item(integer) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_workshop_item(bigint) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_record(integer) TO zeepcentraal_graphql;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION zc_private.is_visible_zsl_level(integer) TO zeepcentraal_graphql;--> statement-breakpoint

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
) TO zeepcentraal_graphql;--> statement-breakpoint

ALTER ROLE zeepcentraal_graphql SET statement_timeout TO '15s';--> statement-breakpoint
ALTER ROLE zeepcentraal_graphql SET lock_timeout TO '3s';--> statement-breakpoint
ALTER ROLE zeepcentraal_graphql SET idle_in_transaction_session_timeout TO '30s';
