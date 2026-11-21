CREATE OR REPLACE FUNCTION public.global_metrics() RETURNS public.global_metric_summary
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE requested_at timestamptz := statement_timestamp(); result public.global_metric_summary;
BEGIN
 SELECT s.records,s.records_today,s.records_month,s.personal_bests,s.personal_bests_today,s.personal_bests_month,s.world_records,s.world_records_today,s.world_records_month,s.levels,s.levels_today,s.levels_month,s.votes,s.votes_today,s.votes_month,s.players,s.ranked_players,s.active_players_today,s.active_players_month,s.as_of,s.day_start,s.month_start,s.time_zone,s.records_yesterday,s.records_last_month,s.personal_bests_yesterday,s.personal_bests_last_month,s.world_records_yesterday,s.world_records_last_month,s.levels_yesterday,s.levels_last_month,s.votes_yesterday,s.votes_last_month,s.active_players_yesterday,s.active_players_last_month,s.yesterday_start,s.last_month_start INTO result
 FROM public.statistics s
 WHERE s.semantics_version=3 AND s.as_of<=requested_at AND s.time_zone='Europe/London';
 IF FOUND THEN
  -- Keep counts and labels coherent until the first successful rollover refresh.
  IF result.day_start<>date_trunc('day',requested_at AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London'
   OR result.month_start<>date_trunc('month',requested_at AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London'
   OR result.as_of>=requested_at-interval '60 seconds' THEN RETURN result; END IF;
 END IF;
 RETURN zc_private.compute_global_metrics(requested_at);
END $$;

COMMENT ON FUNCTION public.global_metrics() IS 'Shared headline counts. Live counts use a 60-second cache with exact fallback. Completed periods freeze until rollover refresh; reads retain the previous coherent snapshot until refresh succeeds. Calendar periods use Europe/London.';
