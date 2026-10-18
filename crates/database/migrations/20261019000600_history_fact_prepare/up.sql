SET LOCAL lock_timeout='5s';
SELECT set_config('zc.history_prepare_search_path',current_setting('search_path'),true);
SET LOCAL search_path=pg_catalog;
CREATE TABLE zc_private.record_history_fact (
 id integer NOT NULL,
 time real NOT NULL,
 date_created timestamptz NOT NULL,
 level_id integer NOT NULL,
 user_id integer NOT NULL,
 level_position integer,
 contribution_rank integer,
 level_points integer,
 level_decayed_points real,
 player_decayed_points real,
 is_personal_best boolean NOT NULL,
 is_world_record boolean NOT NULL,
 has_contribution boolean NOT NULL,
 record_eligible boolean NOT NULL,
 PRIMARY KEY(id),
 FOREIGN KEY(id) REFERENCES public.record(id) ON DELETE CASCADE,
 FOREIGN KEY(id,record_eligible) REFERENCES public.record(id,record_eligible) ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE zc_private.record_history_fact ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_eligibility ON zc_private.record_history_fact FOR SELECT TO zeepcentraal_graphql USING(record_eligible);
GRANT SELECT ON zc_private.record_history_fact TO zeepcentraal_graphql;

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
CREATE INDEX history_fact_latest ON zc_private.record_history_fact(date_created DESC NULLS FIRST,id DESC NULLS FIRST) ;
CREATE INDEX history_fact_user_latest ON zc_private.record_history_fact(user_id,date_created DESC NULLS FIRST,id DESC NULLS FIRST) ;
CREATE INDEX history_fact_level_latest ON zc_private.record_history_fact(level_id,id DESC NULLS FIRST) WHERE is_personal_best OR is_world_record;
CREATE INDEX history_fact_level_user_latest ON zc_private.record_history_fact(level_id,user_id,id DESC NULLS FIRST) WHERE is_personal_best;
CREATE INDEX history_fact_player_decayed_points ON zc_private.record_history_fact(player_decayed_points DESC NULLS FIRST,date_created DESC NULLS FIRST,id DESC NULLS FIRST) WHERE has_contribution;
CREATE INDEX history_fact_user_player_decayed_points ON zc_private.record_history_fact(user_id,player_decayed_points DESC NULLS FIRST,date_created DESC NULLS FIRST,id DESC NULLS FIRST) WHERE has_contribution;
CREATE INDEX history_fact_level_points ON zc_private.record_history_fact(level_points DESC NULLS FIRST,date_created DESC NULLS FIRST,id DESC NULLS FIRST) WHERE has_contribution;
CREATE INDEX history_fact_user_level_points ON zc_private.record_history_fact(user_id,level_points DESC NULLS FIRST,date_created DESC NULLS FIRST,id DESC NULLS FIRST) WHERE has_contribution;
CREATE INDEX history_fact_is_personal_best ON zc_private.record_history_fact(date_created DESC NULLS FIRST,id DESC NULLS FIRST) WHERE is_personal_best;
CREATE INDEX history_fact_user_is_personal_best ON zc_private.record_history_fact(user_id,date_created DESC NULLS FIRST,id DESC NULLS FIRST) WHERE is_personal_best;
CREATE INDEX history_fact_is_world_record ON zc_private.record_history_fact(date_created DESC NULLS FIRST,id DESC NULLS FIRST) WHERE is_world_record;
CREATE INDEX history_fact_user_is_world_record ON zc_private.record_history_fact(user_id,date_created DESC NULLS FIRST,id DESC NULLS FIRST) WHERE is_world_record;
REVOKE ALL ON FUNCTION zc_private.mirror_history_fact() FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.backfill_history_fact(integer) FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.history_fact_mismatch(integer[]) FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.verify_history_fact(integer) FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.cutover_history_fact(boolean,boolean) FROM PUBLIC,zeepcentraal_graphql;
REVOKE ALL ON FUNCTION zc_private.rollback_history_fact() FROM PUBLIC,zeepcentraal_graphql;
SELECT set_config('search_path',current_setting('zc.history_prepare_search_path'),true);
