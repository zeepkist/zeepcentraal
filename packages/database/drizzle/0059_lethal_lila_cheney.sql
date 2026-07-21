CREATE TABLE "zc_private"."record_history_index" (
	"history_view" text NOT NULL,
	"id" integer NOT NULL,
	"time" real NOT NULL,
	"date_created" timestamp with time zone NOT NULL,
	"level_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"level_position" integer,
	"contribution_rank" integer,
	"level_points" integer,
	"level_decayed_points" real,
	"player_decayed_points" real,
	"is_personal_best" boolean DEFAULT false NOT NULL,
	"is_world_record" boolean DEFAULT false NOT NULL,
	"has_contribution" boolean DEFAULT false NOT NULL,
	CONSTRAINT "record_history_index_history_view_id_pk" PRIMARY KEY("history_view","id"),
	CONSTRAINT "CK_record_history_index_view" CHECK ("zc_private"."record_history_index"."history_view" IN ('recent', 'personal-bests', 'world-records'))
);--> statement-breakpoint
ALTER TABLE "zc_private"."record_history_index" ADD CONSTRAINT "record_history_index_record_fkey" FOREIGN KEY ("id") REFERENCES "public"."record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

LOCK TABLE
	public.record,
	public.personal_best_global,
	public.world_record_global,
	public.user_point_contribution,
	public.level_points
IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint

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
	'recent',
	submitted_record.id,
	submitted_record.time,
	submitted_record.date_created,
	submitted_record.id_level,
	submitted_record.id_user,
	contribution.level_position,
	contribution.contribution_rank,
	CASE
		WHEN contribution.id_record IS NOT NULL THEN contribution.level_points
		WHEN current_personal_best.id_record IS NOT NULL OR current_world_record.id_record IS NOT NULL
			THEN current_level_points.points
		ELSE NULL
	END,
	contribution.level_decayed_points,
	contribution.player_decayed_points,
	(current_personal_best.id_record IS NOT NULL),
	(current_world_record.id_record IS NOT NULL),
	(contribution.id_record IS NOT NULL)
FROM public.record AS submitted_record
LEFT JOIN public.personal_best_global AS current_personal_best
	ON current_personal_best.id_record = submitted_record.id
LEFT JOIN public.world_record_global AS current_world_record
	ON current_world_record.id_record = submitted_record.id
LEFT JOIN public.user_point_contribution AS contribution
	ON contribution.id_record = submitted_record.id
	AND contribution.id_user = submitted_record.id_user
	AND contribution.id_level = submitted_record.id_level
LEFT JOIN public.level_points AS current_level_points
	ON current_level_points.id_level = submitted_record.id_level;--> statement-breakpoint

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
	'personal-bests',
	submitted_record.id,
	submitted_record.time,
	submitted_record.date_created,
	submitted_record.id_level,
	submitted_record.id_user,
	contribution.level_position,
	contribution.contribution_rank,
	COALESCE(contribution.level_points, current_level_points.points),
	contribution.level_decayed_points,
	contribution.player_decayed_points,
	true,
	(current_world_record.id_record IS NOT NULL),
	(contribution.id_record IS NOT NULL)
FROM public.personal_best_global AS current_personal_best
INNER JOIN public.record AS submitted_record
	ON submitted_record.id = current_personal_best.id_record
LEFT JOIN public.world_record_global AS current_world_record
	ON current_world_record.id_record = submitted_record.id
LEFT JOIN public.user_point_contribution AS contribution
	ON contribution.id_record = submitted_record.id
	AND contribution.id_user = submitted_record.id_user
	AND contribution.id_level = submitted_record.id_level
LEFT JOIN public.level_points AS current_level_points
	ON current_level_points.id_level = submitted_record.id_level;--> statement-breakpoint

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
	'world-records',
	submitted_record.id,
	submitted_record.time,
	submitted_record.date_created,
	submitted_record.id_level,
	submitted_record.id_user,
	contribution.level_position,
	contribution.contribution_rank,
	COALESCE(contribution.level_points, current_level_points.points),
	contribution.level_decayed_points,
	contribution.player_decayed_points,
	(current_personal_best.id_record IS NOT NULL),
	true,
	(contribution.id_record IS NOT NULL)
FROM public.world_record_global AS current_world_record
INNER JOIN public.record AS submitted_record
	ON submitted_record.id = current_world_record.id_record
LEFT JOIN public.personal_best_global AS current_personal_best
	ON current_personal_best.id_record = submitted_record.id
LEFT JOIN public.user_point_contribution AS contribution
	ON contribution.id_record = submitted_record.id
	AND contribution.id_user = submitted_record.id_user
	AND contribution.id_level = submitted_record.id_level
LEFT JOIN public.level_points AS current_level_points
	ON current_level_points.id_level = submitted_record.id_level;--> statement-breakpoint

CREATE INDEX "IX_record_history_index_latest" ON "zc_private"."record_history_index" USING btree ("history_view","date_created" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "IX_record_history_index_user_latest" ON "zc_private"."record_history_index" USING btree ("history_view","user_id","date_created" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "IX_record_history_index_player_value" ON "zc_private"."record_history_index" USING btree ("history_view","has_contribution","player_decayed_points" DESC NULLS FIRST,"date_created" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "IX_record_history_index_user_player_value" ON "zc_private"."record_history_index" USING btree ("history_view","user_id","has_contribution","player_decayed_points" DESC NULLS FIRST,"date_created" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "IX_record_history_index_level_value" ON "zc_private"."record_history_index" USING btree ("history_view","has_contribution","level_points" DESC NULLS FIRST,"date_created" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "IX_record_history_index_user_level_value" ON "zc_private"."record_history_index" USING btree ("history_view","user_id","has_contribution","level_points" DESC NULLS FIRST,"date_created" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.sync_record_history(p_record_id integer)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
	submitted_record public.record%ROWTYPE;
	contribution public.user_point_contribution%ROWTYPE;
	record_is_personal_best boolean;
	record_is_world_record boolean;
	record_has_contribution boolean;
	base_level_points integer;
	effective_level_points integer;
BEGIN
	SELECT *
	INTO submitted_record
	FROM public.record
	WHERE id = p_record_id;

	IF NOT FOUND THEN
		DELETE FROM zc_private.record_history_index
		WHERE id = p_record_id;
		RETURN;
	END IF;

	SELECT EXISTS (
		SELECT 1
		FROM public.personal_best_global
		WHERE id_record = p_record_id
	)
	INTO record_is_personal_best;

	SELECT EXISTS (
		SELECT 1
		FROM public.world_record_global
		WHERE id_record = p_record_id
	)
	INTO record_is_world_record;

	SELECT *
	INTO contribution
	FROM public.user_point_contribution
	WHERE id_record = p_record_id
		AND id_user = submitted_record.id_user
		AND id_level = submitted_record.id_level
	LIMIT 1;
	record_has_contribution := FOUND;

	SELECT points
	INTO base_level_points
	FROM public.level_points
	WHERE id_level = submitted_record.id_level;

	effective_level_points := CASE
		WHEN record_has_contribution THEN contribution.level_points
		WHEN record_is_personal_best OR record_is_world_record THEN base_level_points
		ELSE NULL
	END;

	DELETE FROM zc_private.record_history_index
	WHERE id = p_record_id
		AND (
			(history_view = 'personal-bests' AND NOT record_is_personal_best)
			OR (history_view = 'world-records' AND NOT record_is_world_record)
		);

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
		selected_view.history_view,
		submitted_record.id,
		submitted_record.time,
		submitted_record.date_created,
		submitted_record.id_level,
		submitted_record.id_user,
		CASE WHEN record_has_contribution THEN contribution.level_position ELSE NULL END,
		CASE WHEN record_has_contribution THEN contribution.contribution_rank ELSE NULL END,
		effective_level_points,
		CASE WHEN record_has_contribution THEN contribution.level_decayed_points ELSE NULL END,
		CASE WHEN record_has_contribution THEN contribution.player_decayed_points ELSE NULL END,
		record_is_personal_best,
		record_is_world_record,
		record_has_contribution
	FROM (
		VALUES
			('recent'::text, true),
			('personal-bests'::text, record_is_personal_best),
			('world-records'::text, record_is_world_record)
	) AS selected_view(history_view, include_row)
	WHERE selected_view.include_row
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

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM zc_private.sync_record_history(OLD.id);
		RETURN OLD;
	END IF;

	IF TG_OP = 'UPDATE' AND OLD.id <> NEW.id THEN
		PERFORM zc_private.sync_record_history(LEAST(OLD.id, NEW.id));
		PERFORM zc_private.sync_record_history(GREATEST(OLD.id, NEW.id));
	ELSE
		PERFORM zc_private.sync_record_history(NEW.id);
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_relation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM zc_private.sync_record_history(OLD.id_record);
		RETURN OLD;
	END IF;

	IF TG_OP = 'UPDATE' AND OLD.id_record <> NEW.id_record THEN
		PERFORM zc_private.sync_record_history(LEAST(OLD.id_record, NEW.id_record));
		PERFORM zc_private.sync_record_history(GREATEST(OLD.id_record, NEW.id_record));
	ELSE
		PERFORM zc_private.sync_record_history(NEW.id_record);
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_contribution_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
	record_id integer;
BEGIN
	FOR record_id IN
		SELECT DISTINCT id_record
		FROM new_contributions
		ORDER BY id_record
	LOOP
		PERFORM zc_private.sync_record_history(record_id);
	END LOOP;
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_contribution_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
	record_id integer;
BEGIN
	FOR record_id IN
		SELECT DISTINCT id_record
		FROM old_contributions
		ORDER BY id_record
	LOOP
		PERFORM zc_private.sync_record_history(record_id);
	END LOOP;
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_contribution_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
	record_id integer;
BEGIN
	FOR record_id IN
		SELECT id_record FROM old_contributions
		UNION
		SELECT id_record FROM new_contributions
		ORDER BY id_record
	LOOP
		PERFORM zc_private.sync_record_history(record_id);
	END LOOP;
	RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_level_points()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.id_level <> NEW.id_level) THEN
		UPDATE zc_private.record_history_index
		SET level_points = NULL
		WHERE level_id = OLD.id_level
			AND has_contribution = false
			AND (is_personal_best OR is_world_record);
	END IF;

	IF TG_OP <> 'DELETE' THEN
		UPDATE zc_private.record_history_index
		SET level_points = NEW.points
		WHERE level_id = NEW.id_level
			AND has_contribution = false
			AND (is_personal_best OR is_world_record);
		RETURN NEW;
	END IF;
	RETURN OLD;
END;
$$;--> statement-breakpoint

CREATE TRIGGER "trg__sync_record_history"
AFTER INSERT OR UPDATE OR DELETE ON public.record
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_sync_record_history_record();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history"
AFTER INSERT OR UPDATE OR DELETE ON public.personal_best_global
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_sync_record_history_relation();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history"
AFTER INSERT OR UPDATE OR DELETE ON public.world_record_global
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_sync_record_history_relation();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_insert"
AFTER INSERT ON public.user_point_contribution
REFERENCING NEW TABLE AS new_contributions
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_contribution_insert();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_delete"
AFTER DELETE ON public.user_point_contribution
REFERENCING OLD TABLE AS old_contributions
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_contribution_delete();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history_update"
AFTER UPDATE ON public.user_point_contribution
REFERENCING OLD TABLE AS old_contributions NEW TABLE AS new_contributions
FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_sync_record_history_contribution_update();--> statement-breakpoint
CREATE TRIGGER "trg__sync_record_history"
AFTER INSERT OR UPDATE OR DELETE ON public.level_points
FOR EACH ROW EXECUTE FUNCTION zc_private.tg_sync_record_history_level_points();--> statement-breakpoint

ALTER FUNCTION zc_private.sync_record_history(integer) OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_record() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_relation() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_contribution_insert() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_contribution_delete() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_contribution_update() OWNER TO CURRENT_USER;--> statement-breakpoint
ALTER FUNCTION zc_private.tg_sync_record_history_level_points() OWNER TO CURRENT_USER;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.sync_record_history(integer) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_record() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_relation() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_contribution_insert() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_contribution_delete() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_contribution_update() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION zc_private.tg_sync_record_history_level_points() FROM PUBLIC;--> statement-breakpoint

ANALYZE zc_private.record_history_index;--> statement-breakpoint

DROP VIEW "public"."record_history_entry";--> statement-breakpoint
CREATE VIEW "public"."record_history_entry" WITH (security_invoker = true) AS (
	SELECT
		history_entry.history_view,
		history_entry.id,
		history_entry.time,
		history_entry.date_created,
		history_entry.level_id,
		history_entry.user_id,
		record_user.steam_id AS user_steam_id,
		record_user.steam_name AS user_name,
		record_level.xx_hash AS level_xx_hash,
		visible_level_item.name AS level_name,
		history_entry.level_position,
		history_entry.contribution_rank,
		history_entry.level_points,
		history_entry.level_decayed_points,
		history_entry.player_decayed_points,
		history_entry.is_personal_best,
		history_entry.is_world_record,
		history_entry.has_contribution
	FROM zc_private.record_history_index AS history_entry
	INNER JOIN public."user" AS record_user ON record_user.id = history_entry.user_id
	INNER JOIN public.level AS record_level ON record_level.id = history_entry.level_id
	LEFT JOIN LATERAL (
		SELECT candidate_level_item.name
		FROM public.level_item AS candidate_level_item
		WHERE candidate_level_item.id_level = history_entry.level_id
			AND candidate_level_item.publicly_visible = true
			AND candidate_level_item.deleted = false
		ORDER BY candidate_level_item.updated_at DESC, candidate_level_item.id DESC
		LIMIT 1
	) AS visible_level_item ON true
);--> statement-breakpoint

COMMENT ON TABLE zc_private.record_history_index IS E'@omit';--> statement-breakpoint
COMMENT ON VIEW public.record_history_entry IS E'@primaryKey history_view,id\n@behavior -insert -update -delete';--> statement-breakpoint
REVOKE ALL ON TABLE zc_private.record_history_index FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE public.record_history_entry FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA zc_private TO zeepcentraal_graphql;--> statement-breakpoint
GRANT SELECT ON TABLE zc_private.record_history_index TO zeepcentraal_graphql;--> statement-breakpoint
GRANT SELECT ON TABLE public.record_history_entry TO zeepcentraal_graphql;
