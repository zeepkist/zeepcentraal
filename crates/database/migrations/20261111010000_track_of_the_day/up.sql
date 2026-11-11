SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(1953744431,0);
SELECT pg_advisory_xact_lock(1953744431,1);
SELECT pg_advisory_xact_lock(1953744431,2);

ALTER TABLE public.track_tournament DROP CONSTRAINT "CK_track_tournament_type";
ALTER TABLE public.track_tournament ADD CONSTRAINT "CK_track_tournament_type" CHECK(type IN (0,1,2));
ALTER TABLE public.track_tournament_overall_period DROP CONSTRAINT track_tournament_overall_period_type_check;
ALTER TABLE public.track_tournament_overall_period ADD CONSTRAINT track_tournament_overall_period_type_check CHECK(type IN (0,1,2));
ALTER TABLE public.track_tournament_overall_period DROP CONSTRAINT track_tournament_overall_period_eligible_event_count_check;
ALTER TABLE public.track_tournament_overall_period ADD CONSTRAINT track_tournament_overall_period_eligible_event_count_check CHECK(eligible_event_count BETWEEN 0 AND CASE WHEN type=0 THEN 12 WHEN type=2 THEN 30 ELSE 6 END);
ALTER TABLE zc_private.discord_guild_feed DROP CONSTRAINT "CK_discord_guild_feed_kind";
ALTER TABLE zc_private.discord_guild_feed ADD CONSTRAINT "CK_discord_guild_feed_kind" CHECK(kind IN ('workshop','world_record','rank','totw','totm','totd'));

CREATE OR REPLACE FUNCTION zc_private.refresh_track_tournament_overall(p_type integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF p_type NOT IN (0,1,2) OR p_type IS NULL THEN RAISE EXCEPTION 'invalid tournament type'; END IF;
 PERFORM pg_advisory_xact_lock(1953744431,p_type);
 -- Select periods globally; hiding a level must not bring older periods back.
 WITH eligible AS MATERIALIZED (
  SELECT id,start_at,end_at FROM public.track_tournament
  WHERE type=p_type AND finalized_at IS NOT NULL AND overall_competitive
  ORDER BY end_at DESC,id DESC LIMIT CASE WHEN p_type=0 THEN 12 WHEN p_type=2 THEN 30 ELSE 6 END
 )
 INSERT INTO public.track_tournament_overall_period(type,eligible_event_count,period_start,period_end,last_updated_at)
 SELECT p_type,count(*)::integer,min(start_at),max(end_at),clock_timestamp() FROM eligible
 ON CONFLICT(type) DO UPDATE SET eligible_event_count=excluded.eligible_event_count,
 period_start=excluded.period_start,period_end=excluded.period_end,last_updated_at=excluded.last_updated_at;

 DELETE FROM public.track_tournament_overall_standing WHERE type=p_type;
 WITH eligible AS MATERIALIZED (
  SELECT id,id_level FROM public.track_tournament
  WHERE type=p_type AND finalized_at IS NOT NULL AND overall_competitive
  ORDER BY end_at DESC,id DESC LIMIT CASE WHEN p_type=0 THEN 12 WHEN p_type=2 THEN 30 ELSE 6 END
 ), totals AS (
  SELECT r.id_user,sum(r.points)::integer AS points,count(DISTINCT r.id_tournament)::integer AS events
  FROM eligible e JOIN public.level l ON l.id=e.id_level AND l.publicly_visible
  JOIN public.track_tournament_result r ON r.id_tournament=e.id
  GROUP BY r.id_user HAVING sum(r.points)>0
 )
 INSERT INTO public.track_tournament_overall_standing(type,id_user,total_points,events_played,rank)
 SELECT p_type,id_user,points,events,rank() OVER(ORDER BY points DESC)::integer FROM totals;
END $$;
REVOKE ALL ON FUNCTION zc_private.refresh_track_tournament_overall(integer) FROM PUBLIC,zeepcentraal_graphql;

SELECT zc_private.refresh_track_tournament_overall(2);
