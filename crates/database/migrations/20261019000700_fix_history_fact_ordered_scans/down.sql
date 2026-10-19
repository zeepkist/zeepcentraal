SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(1869000002, 2);

CREATE OR REPLACE FUNCTION zc_private.cutover_history_fact(p_writers_paused boolean,p_performance_qualified boolean) RETURNS void
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
-- Restore the previous fact layout only when that source is already active.
DO $$
DECLARE state zc_private.history_fact_rollout; replacement text;
BEGIN
 SELECT * INTO STRICT state FROM zc_private.history_fact_rollout FOR UPDATE;
 IF state.switched_at IS NOT NULL THEN
  replacement := regexp_replace(state.original_view,'zc_private\.record_history_index( AS)? history_entry',
   $projection$(SELECT 'recent'::text AS history_view,f.* FROM zc_private.record_history_fact f UNION ALL SELECT 'personal-bests'::text AS history_view,f.* FROM zc_private.record_history_fact f WHERE f.is_personal_best UNION ALL SELECT 'world-records'::text AS history_view,f.* FROM zc_private.record_history_fact f WHERE f.is_world_record) history_entry$projection$);
  IF replacement=state.original_view THEN RAISE EXCEPTION 'Unexpected history view definition'; END IF;
  EXECUTE 'CREATE OR REPLACE VIEW public.record_history_entry WITH (security_invoker=true) AS ' || replacement;
  UPDATE zc_private.history_fact_rollout SET switched_at=clock_timestamp();
 END IF;
END $$;
DROP FUNCTION zc_private.history_fact_view_definition();
