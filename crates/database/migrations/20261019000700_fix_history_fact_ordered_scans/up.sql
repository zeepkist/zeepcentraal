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
