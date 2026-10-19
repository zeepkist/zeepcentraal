-- Rollback rebuilds duplicated storage and indexes. Use a maintenance window with enough free space.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='0';
SET LOCAL transaction_timeout='0';
SELECT set_config('zc.history_retire_rollback_search_path',current_setting('search_path'),true);
SET LOCAL search_path=pg_catalog;
SELECT pg_advisory_xact_lock(1869000002,2);
LOCK TABLE public.record,public.personal_best_global,public.world_record_global,
 public.user_point_contribution,public.level_points,zc_private.record_history_fact IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE zc_private.record_history_index (
    history_view text NOT NULL,
    id integer NOT NULL,
    "time" real NOT NULL,
    date_created timestamp with time zone NOT NULL,
    level_id integer NOT NULL,
    user_id integer NOT NULL,
    level_position integer,
    contribution_rank integer,
    level_points integer,
    level_decayed_points real,
    player_decayed_points real,
    is_personal_best boolean DEFAULT false NOT NULL,
    is_world_record boolean DEFAULT false NOT NULL,
    has_contribution boolean DEFAULT false NOT NULL,
    record_eligible boolean DEFAULT true NOT NULL,
    CONSTRAINT "CK_record_history_index_view" CHECK ((history_view = ANY (ARRAY['recent'::text, 'personal-bests'::text, 'world-records'::text])))
);

COMMENT ON TABLE zc_private.record_history_index IS '@omit';

COMMENT ON COLUMN zc_private.record_history_index.record_eligible IS '@omit
@behavior -aggregate -groupBy -havingBy';

ALTER TABLE zc_private.record_history_index ENABLE ROW LEVEL SECURITY;
INSERT INTO zc_private.record_history_index
(history_view,id,time,date_created,level_id,user_id,level_position,contribution_rank,level_points,
 level_decayed_points,player_decayed_points,is_personal_best,is_world_record,has_contribution,record_eligible)
SELECT v.history_view,f.* FROM zc_private.record_history_fact f
CROSS JOIN LATERAL(VALUES('recent'::text,true),('personal-bests'::text,f.is_personal_best),
 ('world-records'::text,f.is_world_record)) v(history_view,include_row) WHERE v.include_row;
ALTER TABLE ONLY zc_private.record_history_index
    ADD CONSTRAINT record_history_index_history_view_id_pk PRIMARY KEY (history_view, id);

CREATE INDEX "IX_record_history_index_latest" ON zc_private.record_history_index USING btree (history_view, date_created DESC, id DESC);

CREATE INDEX "IX_record_history_index_level_latest" ON zc_private.record_history_index USING btree (history_view, level_id, id DESC) WHERE (history_view = ANY (ARRAY['personal-bests'::text, 'world-records'::text]));

CREATE INDEX "IX_record_history_index_level_projection" ON zc_private.record_history_index USING btree (level_id) WHERE ((has_contribution = false) AND (is_personal_best OR is_world_record));

CREATE INDEX "IX_record_history_index_level_user_latest" ON zc_private.record_history_index USING btree (history_view, level_id, user_id, id DESC) WHERE (history_view = 'personal-bests'::text);

CREATE INDEX "IX_record_history_index_level_value" ON zc_private.record_history_index USING btree (history_view, has_contribution, level_points DESC, date_created DESC, id DESC);

CREATE INDEX "IX_record_history_index_player_value" ON zc_private.record_history_index USING btree (history_view, has_contribution, player_decayed_points DESC, date_created DESC, id DESC);

CREATE INDEX "IX_record_history_index_record" ON zc_private.record_history_index USING btree (id);

CREATE INDEX "IX_record_history_index_user_latest" ON zc_private.record_history_index USING btree (history_view, user_id, date_created DESC, id DESC);

CREATE INDEX "IX_record_history_index_user_level_value" ON zc_private.record_history_index USING btree (history_view, user_id, has_contribution, level_points DESC, date_created DESC, id DESC);

CREATE INDEX "IX_record_history_index_user_player_value" ON zc_private.record_history_index USING btree (history_view, user_id, has_contribution, player_decayed_points DESC, date_created DESC, id DESC);

CREATE INDEX "IX_record_history_level_value_contributing" ON zc_private.record_history_index USING btree (history_view, level_points DESC, date_created DESC, id DESC) WHERE has_contribution;

CREATE INDEX "IX_record_history_player_value_contributing" ON zc_private.record_history_index USING btree (history_view, player_decayed_points DESC, date_created DESC, id DESC) WHERE has_contribution;

CREATE INDEX "IX_record_history_user_level_value_contributing" ON zc_private.record_history_index USING btree (history_view, user_id, level_points DESC, date_created DESC, id DESC) WHERE has_contribution;

CREATE INDEX "IX_record_history_user_player_value_contributing" ON zc_private.record_history_index USING btree (history_view, user_id, player_decayed_points DESC, date_created DESC, id DESC) WHERE has_contribution;

CREATE TRIGGER initialize_record_eligibility BEFORE INSERT OR UPDATE OF id, record_eligible ON zc_private.record_history_index FOR EACH ROW EXECUTE FUNCTION zc_private.tg_initialize_record_eligibility();

ALTER TABLE ONLY zc_private.record_history_index
    ADD CONSTRAINT record_history_index_eligibility_fkey FOREIGN KEY (id, record_eligible) REFERENCES public.record(id, record_eligible) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY zc_private.record_history_index
    ADD CONSTRAINT record_history_index_record_fkey FOREIGN KEY (id) REFERENCES public.record(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT record_history_index_eligibility_fkey ON zc_private.record_history_index IS '@omit';

CREATE POLICY record_eligibility ON zc_private.record_history_index FOR SELECT TO zeepcentraal_graphql USING (record_eligible);

CREATE OR REPLACE FUNCTION zc_private.sync_record_history_contributions(p_record_ids integer[]) RETURNS void
    LANGUAGE sql
    SET search_path TO 'pg_catalog'
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
$$;

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_level_points() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
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

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_record_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
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
$$;

CREATE OR REPLACE FUNCTION zc_private.sync_record_history(p_record_id integer) RETURNS void LANGUAGE sql SET search_path=pg_catalog AS $$ SELECT zc_private.sync_record_history_records(ARRAY[p_record_id]) $$;

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
		has_contribution = EXCLUDED.has_contribution
 WHERE ROW(record_history_index.time,record_history_index.date_created,record_history_index.level_id,record_history_index.user_id,record_history_index.level_position,record_history_index.contribution_rank,record_history_index.level_points,record_history_index.level_decayed_points,record_history_index.player_decayed_points,record_history_index.is_personal_best,record_history_index.is_world_record,record_history_index.has_contribution)
 IS DISTINCT FROM ROW(EXCLUDED.time,EXCLUDED.date_created,EXCLUDED.level_id,EXCLUDED.user_id,EXCLUDED.level_position,EXCLUDED.contribution_rank,EXCLUDED.level_points,EXCLUDED.level_decayed_points,EXCLUDED.player_decayed_points,EXCLUDED.is_personal_best,EXCLUDED.is_world_record,EXCLUDED.has_contribution);
END;
$$;

REVOKE ALL ON zc_private.record_history_index FROM PUBLIC;
GRANT SELECT ON zc_private.record_history_index TO zeepcentraal_graphql;
CREATE OR REPLACE VIEW public.record_history_entry WITH (security_invoker=true) AS
 SELECT history_entry.history_view,
    history_entry.id,
    history_entry."time",
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
   FROM zc_private.record_history_index history_entry
     JOIN public."user" record_user ON record_user.id = history_entry.user_id
     JOIN public.level record_level ON record_level.id = history_entry.level_id
     LEFT JOIN LATERAL ( SELECT candidate_level_item.name
           FROM public.level_item candidate_level_item
          WHERE candidate_level_item.id_level = history_entry.level_id AND candidate_level_item.publicly_visible = true AND candidate_level_item.deleted = false
          ORDER BY candidate_level_item.updated_at DESC, candidate_level_item.id DESC
         LIMIT 1) visible_level_item ON true;
CREATE TABLE zc_private.history_fact_rollout (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 backfill_after integer NOT NULL DEFAULT 0,
 backfill_done boolean NOT NULL DEFAULT false,
 verify_after integer NOT NULL DEFAULT 0,
 verified boolean NOT NULL DEFAULT false,
 original_view text NOT NULL,
 switched_at timestamptz
);
INSERT INTO zc_private.history_fact_rollout(singleton,original_view) VALUES(true,pg_get_viewdef('public.record_history_entry'::regclass,true));
CREATE TABLE zc_private.history_fact_dirty(id integer PRIMARY KEY);
REVOKE ALL ON zc_private.history_fact_rollout,zc_private.history_fact_dirty FROM PUBLIC,zeepcentraal_graphql;

CREATE FUNCTION zc_private.mirror_history_fact() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.history_view<>'recent' THEN RETURN NULL; END IF;
  DELETE FROM zc_private.record_history_fact WHERE id=OLD.id;
  INSERT INTO zc_private.history_fact_dirty VALUES(OLD.id) ON CONFLICT DO NOTHING;
 ELSE
  IF NEW.history_view<>'recent' THEN RETURN NULL; END IF;
  INSERT INTO zc_private.record_history_fact AS previous (id,time,date_created,level_id,user_id,level_position,contribution_rank,level_points,level_decayed_points,player_decayed_points,is_personal_best,is_world_record,has_contribution,record_eligible)
  VALUES(NEW.id,NEW.time,NEW.date_created,NEW.level_id,NEW.user_id,NEW.level_position,NEW.contribution_rank,NEW.level_points,NEW.level_decayed_points,NEW.player_decayed_points,NEW.is_personal_best,NEW.is_world_record,NEW.has_contribution,NEW.record_eligible)
  ON CONFLICT(id) DO UPDATE SET time=excluded.time,date_created=excluded.date_created,level_id=excluded.level_id,user_id=excluded.user_id,level_position=excluded.level_position,contribution_rank=excluded.contribution_rank,level_points=excluded.level_points,level_decayed_points=excluded.level_decayed_points,player_decayed_points=excluded.player_decayed_points,is_personal_best=excluded.is_personal_best,is_world_record=excluded.is_world_record,has_contribution=excluded.has_contribution,record_eligible=excluded.record_eligible
  WHERE ROW(previous.time,previous.date_created,previous.level_id,previous.user_id,previous.level_position,previous.contribution_rank,previous.level_points,previous.level_decayed_points,previous.player_decayed_points,previous.is_personal_best,previous.is_world_record,previous.has_contribution,previous.record_eligible) IS DISTINCT FROM ROW(excluded.time,excluded.date_created,excluded.level_id,excluded.user_id,excluded.level_position,excluded.contribution_rank,excluded.level_points,excluded.level_decayed_points,excluded.player_decayed_points,excluded.is_personal_best,excluded.is_world_record,excluded.has_contribution,excluded.record_eligible);
  INSERT INTO zc_private.history_fact_dirty VALUES(NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER mirror_history_fact AFTER INSERT OR UPDATE OR DELETE ON zc_private.record_history_index
FOR EACH ROW EXECUTE FUNCTION zc_private.mirror_history_fact();

CREATE FUNCTION zc_private.backfill_history_fact(p_limit integer DEFAULT 1000) RETURNS integer
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE ids integer[]; cursor_id integer;
BEGIN
 IF p_limit<1 OR p_limit>10000 THEN RAISE EXCEPTION 'Invalid history batch size'; END IF;
 PERFORM pg_advisory_xact_lock(1869000002,2);
 SELECT backfill_after INTO cursor_id FROM zc_private.history_fact_rollout FOR UPDATE;
 SELECT array_agg(id ORDER BY id) INTO ids FROM (
  SELECT id FROM zc_private.record_history_index WHERE history_view='recent' AND id>cursor_id ORDER BY id LIMIT p_limit
 ) page;
 IF ids IS NULL THEN
  UPDATE zc_private.history_fact_rollout SET backfill_done=true;
  RETURN 0;
 END IF;
 INSERT INTO zc_private.record_history_fact(id,time,date_created,level_id,user_id,level_position,contribution_rank,level_points,level_decayed_points,player_decayed_points,is_personal_best,is_world_record,has_contribution,record_eligible)
 SELECT id,time,date_created,level_id,user_id,level_position,contribution_rank,level_points,level_decayed_points,player_decayed_points,is_personal_best,is_world_record,has_contribution,record_eligible FROM zc_private.record_history_index WHERE history_view='recent' AND id=ANY(ids) ORDER BY id FOR SHARE
 ON CONFLICT(id) DO NOTHING;
 UPDATE zc_private.history_fact_rollout SET backfill_after=ids[cardinality(ids)],verified=false;
 RETURN cardinality(ids);
END $$;

CREATE FUNCTION zc_private.history_fact_mismatch(p_ids integer[]) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 WITH source AS (SELECT to_jsonb(s) AS row FROM zc_private.record_history_index s WHERE s.id=ANY(p_ids)),
 projected AS (
  SELECT jsonb_build_object('history_view',v.history_view)||to_jsonb(f) AS row
  FROM zc_private.record_history_fact f CROSS JOIN LATERAL (
   VALUES('recent'::text,true),('personal-bests'::text,f.is_personal_best),('world-records'::text,f.is_world_record)
  ) v(history_view,include_row) WHERE f.id=ANY(p_ids) AND v.include_row
 )
 SELECT EXISTS((SELECT * FROM source EXCEPT SELECT * FROM projected) UNION ALL (SELECT * FROM projected EXCEPT SELECT * FROM source))
$$;

CREATE FUNCTION zc_private.verify_history_fact(p_limit integer DEFAULT 1000) RETURNS integer
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE ids integer[]; cursor_id integer;
BEGIN
 IF p_limit<1 OR p_limit>10000 THEN RAISE EXCEPTION 'Invalid history batch size'; END IF;
 PERFORM pg_advisory_xact_lock(1869000002,2);
 SELECT verify_after INTO cursor_id FROM zc_private.history_fact_rollout WHERE backfill_done FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Complete history backfill first'; END IF;
 SELECT array_agg(id ORDER BY id) INTO ids FROM (
  SELECT id FROM (
   SELECT id FROM zc_private.record_history_index WHERE history_view='recent' AND id>cursor_id
   UNION SELECT id FROM zc_private.record_history_fact WHERE id>cursor_id
  ) candidates ORDER BY id LIMIT p_limit
 ) page;
 IF ids IS NULL THEN
  SELECT array_agg(id ORDER BY id) INTO ids FROM (SELECT id FROM zc_private.history_fact_dirty ORDER BY id LIMIT p_limit) page;
 END IF;
 IF ids IS NULL THEN UPDATE zc_private.history_fact_rollout SET verified=true; RETURN 0; END IF;
 PERFORM id FROM zc_private.history_fact_dirty WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
 IF zc_private.history_fact_mismatch(ids) THEN RAISE EXCEPTION 'History fact parity failed'; END IF;
 DELETE FROM zc_private.history_fact_dirty WHERE id=ANY(ids);
 UPDATE zc_private.history_fact_rollout SET verify_after=greatest(verify_after,ids[cardinality(ids)]);
 RETURN cardinality(ids);
END $$;

CREATE FUNCTION zc_private.cutover_history_fact(p_writers_paused boolean,p_performance_qualified boolean) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE state zc_private.history_fact_rollout; ids integer[]; definition text; replacement text;
BEGIN
 IF p_writers_paused IS DISTINCT FROM true OR p_performance_qualified IS DISTINCT FROM true THEN RAISE EXCEPTION 'Paused writers and performance qualification required'; END IF;
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(1869000002,2);
 LOCK TABLE public.record,public.personal_best_global,public.world_record_global,public.user_point_contribution,
  public.level_points,zc_private.record_history_index,zc_private.record_history_fact IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO state FROM zc_private.history_fact_rollout FOR UPDATE;
 IF state.switched_at IS NOT NULL THEN RETURN; END IF;
 IF NOT state.backfill_done OR NOT state.verified THEN RAISE EXCEPTION 'History backfill and verification required'; END IF;
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM zc_private.history_fact_dirty LIMIT 10001) bounded;
 IF cardinality(ids)>10000 THEN RAISE EXCEPTION 'History delta exceeds cutover budget; verify again'; END IF;
 IF ids IS NOT NULL AND zc_private.history_fact_mismatch(ids) THEN RAISE EXCEPTION 'History fact parity failed'; END IF;
 definition := state.original_view;
 replacement := regexp_replace(definition,'zc_private\.record_history_index( AS)? history_entry',
  $projection$(SELECT 'recent'::text AS history_view,f.* FROM zc_private.record_history_fact f  UNION ALL SELECT 'personal-bests'::text AS history_view,f.* FROM zc_private.record_history_fact f WHERE f.is_personal_best  UNION ALL SELECT 'world-records'::text AS history_view,f.* FROM zc_private.record_history_fact f WHERE f.is_world_record) history_entry$projection$);
 IF replacement=definition THEN RAISE EXCEPTION 'Unexpected history view definition'; END IF;
 EXECUTE 'CREATE OR REPLACE VIEW public.record_history_entry WITH (security_invoker=true) AS '||replacement;
 DELETE FROM zc_private.history_fact_dirty;
 UPDATE zc_private.history_fact_rollout SET switched_at=clock_timestamp();
END $$;

CREATE FUNCTION zc_private.rollback_history_fact() RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE definition text;
BEGIN
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(1869000002,2);
 SELECT original_view INTO definition FROM zc_private.history_fact_rollout FOR UPDATE;
 EXECUTE 'CREATE OR REPLACE VIEW public.record_history_entry WITH (security_invoker=true) AS '||definition;
 UPDATE zc_private.history_fact_rollout SET switched_at=NULL;
END $$;

REVOKE ALL ON FUNCTION zc_private.mirror_history_fact() FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.backfill_history_fact(integer) FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.history_fact_mismatch(integer[]) FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.verify_history_fact(integer) FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.cutover_history_fact(boolean,boolean) FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.rollback_history_fact() FROM PUBLIC,zeepcentraal_graphql;
UPDATE zc_private.history_fact_rollout SET backfill_done=true,verified=true,
 backfill_after=coalesce((SELECT max(id) FROM zc_private.record_history_fact),0),
 verify_after=coalesce((SELECT max(id) FROM zc_private.record_history_fact),0);
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(1869000002, 2);

CREATE FUNCTION zc_private.history_fact_view_definition() RETURNS text
LANGUAGE plpgsql STABLE SET search_path = pg_catalog AS $$
DECLARE definition text; replacement text;
BEGIN
 SELECT original_view INTO STRICT definition FROM zc_private.history_fact_rollout;
 -- Leaf WHERE clauses stop UNION members being pulled into the append relation.
 -- Keep leaves unfiltered; apply category membership after the UNION instead.
 replacement := regexp_replace(definition, 'zc_private\.record_history_index( AS)? history_entry',
  $projection$(SELECT 'recent'::text AS history_view,f.* FROM zc_private.record_history_fact f UNION ALL SELECT 'personal-bests'::text AS history_view,f.* FROM zc_private.record_history_fact f UNION ALL SELECT 'world-records'::text AS history_view,f.* FROM zc_private.record_history_fact f) history_entry$projection$);
 IF replacement = definition THEN RAISE EXCEPTION 'Unexpected history view definition'; END IF;
 RETURN 'SELECT history_projection.* FROM (' || regexp_replace(replacement, ';\s*$', '') ||
  ') history_projection WHERE history_projection.history_view=''recent'' OR ' ||
  '(history_projection.history_view=''personal-bests'' AND history_projection.is_personal_best) OR ' ||
  '(history_projection.history_view=''world-records'' AND history_projection.is_world_record)';
END $$;
REVOKE ALL ON FUNCTION zc_private.history_fact_view_definition() FROM PUBLIC, zeepcentraal_graphql;

CREATE OR REPLACE FUNCTION zc_private.cutover_history_fact(p_writers_paused boolean,p_performance_qualified boolean) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE state zc_private.history_fact_rollout; ids integer[];
BEGIN
 IF p_writers_paused IS DISTINCT FROM true OR p_performance_qualified IS DISTINCT FROM true THEN RAISE EXCEPTION 'Paused writers and performance qualification required'; END IF;
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM pg_advisory_xact_lock(1869000002,2);
 LOCK TABLE public.record,public.personal_best_global,public.world_record_global,public.user_point_contribution,
  public.level_points,zc_private.record_history_index,zc_private.record_history_fact IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO state FROM zc_private.history_fact_rollout FOR UPDATE;
 IF state.switched_at IS NOT NULL THEN RETURN; END IF;
 IF NOT state.backfill_done OR NOT state.verified THEN RAISE EXCEPTION 'History backfill and verification required'; END IF;
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM zc_private.history_fact_dirty LIMIT 10001) bounded;
 IF cardinality(ids)>10000 THEN RAISE EXCEPTION 'History delta exceeds cutover budget; verify again'; END IF;
 IF ids IS NOT NULL AND zc_private.history_fact_mismatch(ids) THEN RAISE EXCEPTION 'History fact parity failed'; END IF;
 EXECUTE 'CREATE OR REPLACE VIEW public.record_history_entry WITH (security_invoker=true) AS ' || zc_private.history_fact_view_definition();
 DELETE FROM zc_private.history_fact_dirty;
 UPDATE zc_private.history_fact_rollout SET switched_at=clock_timestamp();
END $$;

-- An already-active fact view needs no backfill or writer pause. Replacing its
-- equivalent SELECT preserves the view OID, grants, comments, and column types.
DO $$
DECLARE active boolean;
BEGIN
 SELECT switched_at IS NOT NULL INTO STRICT active FROM zc_private.history_fact_rollout FOR UPDATE;
 IF active THEN
  EXECUTE 'CREATE OR REPLACE VIEW public.record_history_entry WITH (security_invoker=true) AS ' || zc_private.history_fact_view_definition();
  UPDATE zc_private.history_fact_rollout SET switched_at=clock_timestamp();
 END IF;
END $$;

SELECT zc_private.cutover_history_fact(true,true);
ANALYZE zc_private.record_history_index;
SELECT set_config('search_path',current_setting('zc.history_retire_rollback_search_path'),true);
