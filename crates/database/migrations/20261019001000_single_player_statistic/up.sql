SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(1869000002,1);
-- Remaining counters keep their definitions and the same snapshot timestamp.
UPDATE public.statistics SET semantics_version=2 WHERE semantics_version=1;
ALTER TABLE public.statistics DROP COLUMN players_all;
ALTER TYPE public.global_metric_summary DROP ATTRIBUTE players_all;

CREATE OR REPLACE FUNCTION zc_private.compute_global_metrics(p_as_of timestamptz)
RETURNS public.global_metric_summary LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
 WITH windows AS MATERIALIZED (
  SELECT p_as_of AS as_of,
   date_trunc('day',p_as_of AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' AS day_start,
   date_trunc('month',p_as_of AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London' AS month_start
 ), records AS (SELECT count(*) AS total,
 count(*) FILTER (WHERE r.date_created>=w.day_start AND r.date_created<w.as_of) AS today,
 count(*) FILTER (WHERE r.date_created>=w.month_start AND r.date_created<w.as_of) AS month
 FROM public.record r  CROSS JOIN windows w WHERE r.record_eligible),
 personal_bests AS (SELECT count(*) AS total,
 count(*) FILTER (WHERE r.date_created>=w.day_start AND r.date_created<w.as_of) AS today,
 count(*) FILTER (WHERE r.date_created>=w.month_start AND r.date_created<w.as_of) AS month
 FROM public.personal_best_global pb JOIN public.record r ON r.id=pb.id_record CROSS JOIN windows w WHERE pb.record_eligible AND r.record_eligible), eligible_world_records AS MATERIALIZED (
 -- Isolate availability before the single-row calendar join. Otherwise the planner
 -- can underestimate the join and repeatedly scan all WRs for every available level.
 SELECT r.date_created FROM public.world_record_global wr JOIN public.record r ON r.id=wr.id_record
 WHERE wr.record_eligible AND r.record_eligible
 AND EXISTS(SELECT 1 FROM public.level_item i WHERE i.id_level=wr.id_level AND NOT i.deleted)
 ), world_records AS (SELECT count(*) AS total,
 count(*) FILTER (WHERE r.date_created>=w.day_start AND r.date_created<w.as_of) AS today,
 count(*) FILTER (WHERE r.date_created>=w.month_start AND r.date_created<w.as_of) AS month
 FROM eligible_world_records r CROSS JOIN windows w),
 levels AS (SELECT count(*) AS total,
 count(*) FILTER (WHERE l.date_created>=w.day_start AND l.date_created<w.as_of) AS today,
 count(*) FILTER (WHERE l.date_created>=w.month_start AND l.date_created<w.as_of) AS month
 FROM public.level l  CROSS JOIN windows w WHERE l.publicly_visible),
 votes AS (SELECT count(*) AS total,
 count(*) FILTER (WHERE v.date_created>=w.day_start AND v.date_created<w.as_of) AS today,
 count(*) FILTER (WHERE v.date_created>=w.month_start AND v.date_created<w.as_of) AS month
 FROM public.vote v  CROSS JOIN windows w WHERE true),
 activity AS (
  SELECT r.id_user, r.date_created AS occurred_at FROM public.record r CROSS JOIN windows w
   WHERE r.record_eligible AND r.date_created>=w.month_start AND r.date_created<w.as_of
  UNION ALL
  SELECT u.id, i.created_at FROM public.level_item i JOIN public."user" u ON u.steam_id=i.author_id CROSS JOIN windows w
   WHERE i.publicly_visible AND NOT i.deleted AND i.created_at>=w.month_start AND i.created_at<w.as_of
  UNION ALL
  SELECT result.id_user, round.event_date FROM public.zsl_level_result result
   JOIN public.zsl_level l ON l.id=result.id_level JOIN public.zsl_round round ON round.id=l.id_round CROSS JOIN windows w
   WHERE round.event_date>=w.month_start AND round.event_date<w.as_of
 ), active AS (
  SELECT count(DISTINCT a.id_user) FILTER (WHERE a.occurred_at>=w.day_start) AS today,
   count(DISTINCT a.id_user) AS month
  FROM activity a JOIN public."user" u ON u.id=a.id_user AND NOT u.banned CROSS JOIN windows w
 ), players AS (
  SELECT count(*) FILTER (WHERE NOT u.banned) AS total,
   count(*) FILTER (WHERE NOT u.banned AND EXISTS(SELECT 1 FROM public.user_points p WHERE p.id_user=u.id AND p.rank<>-1)) AS ranked
  FROM public."user" u
 )
 SELECT ROW(records.total,records.today,records.month,personal_bests.total,personal_bests.today,personal_bests.month,
  world_records.total,world_records.today,world_records.month,levels.total,levels.today,levels.month,
  votes.total,votes.today,votes.month,players.total,players.ranked,active.today,active.month,
  w.as_of,w.day_start,w.month_start,'Europe/London')::public.global_metric_summary
 FROM windows w CROSS JOIN records CROSS JOIN personal_bests CROSS JOIN world_records CROSS JOIN levels CROSS JOIN votes CROSS JOIN players CROSS JOIN active
$$;
REVOKE ALL ON FUNCTION zc_private.compute_global_metrics(timestamptz) FROM PUBLIC, zeepcentraal_graphql;

CREATE OR REPLACE FUNCTION zc_private.refresh_global_metrics() RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE snapshot public.global_metric_summary;
BEGIN
 IF NOT pg_try_advisory_xact_lock(1869000002,1) THEN RETURN; END IF;
 snapshot := zc_private.compute_global_metrics(statement_timestamp());
 INSERT INTO public.statistics AS previous (singleton,semantics_version,records,records_today,records_month,personal_bests,personal_bests_today,personal_bests_month,world_records,world_records_today,world_records_month,levels,levels_today,levels_month,votes,votes_today,votes_month,players,ranked_players,active_players_today,active_players_month,as_of,day_start,month_start,time_zone)
 SELECT true,2,snapshot.records,snapshot.records_today,snapshot.records_month,snapshot.personal_bests,snapshot.personal_bests_today,snapshot.personal_bests_month,snapshot.world_records,snapshot.world_records_today,snapshot.world_records_month,snapshot.levels,snapshot.levels_today,snapshot.levels_month,snapshot.votes,snapshot.votes_today,snapshot.votes_month,snapshot.players,snapshot.ranked_players,snapshot.active_players_today,snapshot.active_players_month,snapshot.as_of,snapshot.day_start,snapshot.month_start,snapshot.time_zone
 ON CONFLICT(singleton) DO UPDATE SET
  semantics_version=excluded.semantics_version,
  records=excluded.records,
  records_today=excluded.records_today,
  records_month=excluded.records_month,
  personal_bests=excluded.personal_bests,
  personal_bests_today=excluded.personal_bests_today,
  personal_bests_month=excluded.personal_bests_month,
  world_records=excluded.world_records,
  world_records_today=excluded.world_records_today,
  world_records_month=excluded.world_records_month,
  levels=excluded.levels,
  levels_today=excluded.levels_today,
  levels_month=excluded.levels_month,
  votes=excluded.votes,
  votes_today=excluded.votes_today,
  votes_month=excluded.votes_month,
  players=excluded.players,  ranked_players=excluded.ranked_players,
  active_players_today=excluded.active_players_today,
  active_players_month=excluded.active_players_month,
  as_of=excluded.as_of,
  day_start=excluded.day_start,
  month_start=excluded.month_start,
  time_zone=excluded.time_zone
 WHERE previous.as_of<excluded.as_of AND previous.semantics_version<=excluded.semantics_version;
END $$;
REVOKE ALL ON FUNCTION zc_private.refresh_global_metrics() FROM PUBLIC, zeepcentraal_graphql;


CREATE OR REPLACE FUNCTION public.global_metrics() RETURNS public.global_metric_summary
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE requested_at timestamptz := statement_timestamp(); result public.global_metric_summary;
BEGIN
 SELECT s.records,s.records_today,s.records_month,s.personal_bests,s.personal_bests_today,s.personal_bests_month,s.world_records,s.world_records_today,s.world_records_month,s.levels,s.levels_today,s.levels_month,s.votes,s.votes_today,s.votes_month,s.players,s.ranked_players,s.active_players_today,s.active_players_month,s.as_of,s.day_start,s.month_start,s.time_zone INTO result
 FROM public.statistics s
 WHERE s.semantics_version=2 AND s.as_of<=requested_at AND s.as_of>=requested_at-interval '60 seconds'
  AND s.time_zone='Europe/London'
  AND s.day_start=date_trunc('day',requested_at AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London'
  AND s.month_start=date_trunc('month',requested_at AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London';
 IF FOUND THEN RETURN result; END IF;
 RETURN zc_private.compute_global_metrics(requested_at);
END $$;
REVOKE ALL ON FUNCTION public.global_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.global_metrics() TO zeepcentraal_graphql;
COMMENT ON FUNCTION public.global_metrics() IS 'Shared headline counts. Maximum cache age 60 seconds at request start; exact fallback. Calendar periods use Europe/London.';

-- Migration 009 already seeded the cache. Only recompute if its row is missing.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.statistics) THEN
  PERFORM zc_private.refresh_global_metrics();
 END IF;
END $$;
