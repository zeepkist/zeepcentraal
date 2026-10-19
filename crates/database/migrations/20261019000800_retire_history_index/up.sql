-- The Rust migrator commits online backfill/verification batches before this transaction.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL transaction_timeout='60s';
SELECT pg_advisory_xact_lock(1869000002,2);
LOCK TABLE public.record,public.personal_best_global,public.world_record_global,
 public.user_point_contribution,public.level_points,zc_private.record_history_index,
 zc_private.record_history_fact IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE state zc_private.history_fact_rollout; ids integer[];
BEGIN
 SELECT * INTO STRICT state FROM zc_private.history_fact_rollout FOR UPDATE;
 IF NOT state.backfill_done OR NOT state.verified THEN
  RAISE EXCEPTION 'Run adopt with the current Rust migrator to backfill and verify history first';
 END IF;
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM zc_private.history_fact_dirty ORDER BY id LIMIT 10001) bounded;
 IF cardinality(ids)>10000 THEN RAISE EXCEPTION 'History delta exceeds retirement budget; rerun adopt'; END IF;
 IF ids IS NOT NULL AND zc_private.history_fact_mismatch(ids) THEN RAISE EXCEPTION 'History fact parity failed'; END IF;
 EXECUTE 'CREATE OR REPLACE VIEW public.record_history_entry WITH (security_invoker=true) AS '||zc_private.history_fact_view_definition();
 UPDATE zc_private.history_fact_rollout SET switched_at=coalesce(switched_at,clock_timestamp());
END $$;

CREATE OR REPLACE FUNCTION zc_private.sync_record_history_records(p_record_ids integer[]) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 DELETE FROM zc_private.record_history_fact f WHERE f.id=ANY(p_record_ids)
  AND NOT EXISTS(SELECT 1 FROM public.record r WHERE r.id=f.id);
 WITH state AS (
  SELECT r.*,EXISTS(SELECT 1 FROM public.personal_best_global p WHERE p.id_record=r.id) AS pb,
   EXISTS(SELECT 1 FROM public.world_record_global w WHERE w.id_record=r.id) AS wr,
   c.id_record IS NOT NULL AS contributed,c.level_position,c.contribution_rank,
   c.level_points,c.level_decayed_points,c.player_decayed_points,lp.points AS base_points
  FROM public.record r
  LEFT JOIN LATERAL (SELECT c.* FROM public.user_point_contribution c
   WHERE c.id_record=r.id AND c.id_user=r.id_user AND c.id_level=r.id_level LIMIT 1) c ON true
  LEFT JOIN public.level_points lp ON lp.id_level=r.id_level WHERE r.id=ANY(p_record_ids)
 )
 INSERT INTO zc_private.record_history_fact AS previous
 (id,time,date_created,level_id,user_id,level_position,contribution_rank,level_points,
  level_decayed_points,player_decayed_points,is_personal_best,is_world_record,has_contribution,record_eligible)
 SELECT id,time,date_created,id_level,id_user,
  CASE WHEN contributed THEN level_position END,CASE WHEN contributed THEN contribution_rank END,
  CASE WHEN contributed THEN level_points WHEN pb OR wr THEN base_points END,
  CASE WHEN contributed THEN level_decayed_points END,CASE WHEN contributed THEN player_decayed_points END,
  pb,wr,contributed,record_eligible FROM state ORDER BY id
 ON CONFLICT(id) DO UPDATE SET time=excluded.time,date_created=excluded.date_created,
  level_id=excluded.level_id,user_id=excluded.user_id,level_position=excluded.level_position,
  contribution_rank=excluded.contribution_rank,level_points=excluded.level_points,
  level_decayed_points=excluded.level_decayed_points,player_decayed_points=excluded.player_decayed_points,
  is_personal_best=excluded.is_personal_best,is_world_record=excluded.is_world_record,
  has_contribution=excluded.has_contribution,record_eligible=excluded.record_eligible
 WHERE previous IS DISTINCT FROM excluded;
END $$;

CREATE OR REPLACE FUNCTION zc_private.sync_record_history(p_record_id integer) RETURNS void
LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT zc_private.sync_record_history_records(ARRAY[p_record_id])
$$;

CREATE OR REPLACE FUNCTION zc_private.tg_sync_record_history_record_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO zc_private.record_history_fact AS previous
 (id,time,date_created,level_id,user_id,is_personal_best,is_world_record,has_contribution,record_eligible)
 SELECT id,time,date_created,id_level,id_user,false,false,false,record_eligible
 FROM new_records ORDER BY id
 ON CONFLICT(id) DO UPDATE SET time=excluded.time,date_created=excluded.date_created,
  level_id=excluded.level_id,user_id=excluded.user_id,record_eligible=excluded.record_eligible
 WHERE ROW(previous.time,previous.date_created,previous.level_id,previous.user_id,previous.record_eligible)
  IS DISTINCT FROM ROW(excluded.time,excluded.date_created,excluded.level_id,excluded.user_id,excluded.record_eligible);
 RETURN NULL;
END $$;

DO $$
DECLARE definition text;
BEGIN
 -- Preserve the optimized contribution-only and fallback-points update paths.
 FOREACH definition IN ARRAY ARRAY[
  pg_get_functiondef('zc_private.sync_record_history_contributions(integer[])'::regprocedure),
  pg_get_functiondef('zc_private.tg_sync_record_history_level_points()'::regprocedure)
 ] LOOP
  IF position('zc_private.record_history_index' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected history writer definition'; END IF;
  EXECUTE replace(definition,'zc_private.record_history_index','zc_private.record_history_fact');
 END LOOP;
END $$;
DROP TRIGGER mirror_history_fact ON zc_private.record_history_index;
-- RESTRICT intentionally aborts if an unexpected reader still depends on old storage.
DROP TABLE zc_private.record_history_index;
DROP FUNCTION zc_private.mirror_history_fact();
DROP FUNCTION zc_private.backfill_history_fact(integer);
DROP FUNCTION zc_private.verify_history_fact(integer);
DROP FUNCTION zc_private.history_fact_mismatch(integer[]);
DROP FUNCTION zc_private.cutover_history_fact(boolean,boolean);
DROP FUNCTION zc_private.rollback_history_fact();
DROP FUNCTION zc_private.history_fact_view_definition();
DROP TABLE zc_private.history_fact_dirty,zc_private.history_fact_rollout;
