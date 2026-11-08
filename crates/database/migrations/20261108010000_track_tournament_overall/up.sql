SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(1953744431,0);
SELECT pg_advisory_xact_lock(1953744431,1);

ALTER TABLE public.track_tournament ADD COLUMN overall_competitive boolean;
COMMENT ON COLUMN public.track_tournament.overall_competitive IS E'@omit\n@behavior -aggregate -groupBy -havingBy';
UPDATE public.track_tournament t SET overall_competitive = EXISTS (
 SELECT 1 FROM public.track_tournament_result r WHERE r.id_tournament=t.id
) WHERE t.finalized_at IS NOT NULL;
ALTER TABLE public.track_tournament ADD CONSTRAINT track_tournament_completed_competitive
 CHECK (finalized_at IS NULL OR overall_competitive IS NOT NULL);
CREATE INDEX track_tournament_overall_eligible ON public.track_tournament(type,end_at DESC,id DESC)
 WHERE finalized_at IS NOT NULL AND overall_competitive;

CREATE TABLE public.track_tournament_overall_period (
 type integer PRIMARY KEY CHECK (type IN (0,1)),
 eligible_event_count integer NOT NULL CHECK (eligible_event_count BETWEEN 0 AND CASE WHEN type=0 THEN 12 ELSE 6 END),
 period_start timestamptz,
 period_end timestamptz,
 last_updated_at timestamptz NOT NULL
);
CREATE TABLE public.track_tournament_overall_standing (
 type integer NOT NULL REFERENCES public.track_tournament_overall_period(type),
 id_user integer NOT NULL CONSTRAINT track_tournament_overall_standing_user_fkey REFERENCES public."user"(id) ON DELETE CASCADE,
 total_points integer NOT NULL CHECK (total_points>0),
 events_played integer NOT NULL CHECK (events_played>0),
 rank integer NOT NULL CHECK (rank>0),
 PRIMARY KEY(type,id_user)
);
CREATE INDEX track_tournament_overall_order ON public.track_tournament_overall_standing(type,total_points DESC,id_user);
COMMENT ON TABLE public.track_tournament_overall_period IS E'@behavior -insert -update -delete';
COMMENT ON TABLE public.track_tournament_overall_standing IS E'@behavior -insert -update -delete';
ALTER TABLE public.track_tournament_overall_period ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_tournament_overall_standing ENABLE ROW LEVEL SECURITY;
CREATE POLICY graphql_select_overall_period ON public.track_tournament_overall_period FOR SELECT TO zeepcentraal_graphql USING(true);
CREATE POLICY graphql_select_overall_standing ON public.track_tournament_overall_standing FOR SELECT TO zeepcentraal_graphql USING(true);
REVOKE ALL ON public.track_tournament_overall_period,public.track_tournament_overall_standing FROM PUBLIC;
GRANT SELECT ON public.track_tournament_overall_period,public.track_tournament_overall_standing TO zeepcentraal_graphql;

CREATE FUNCTION zc_private.refresh_track_tournament_overall(p_type integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF p_type NOT IN (0,1) OR p_type IS NULL THEN RAISE EXCEPTION 'invalid tournament type'; END IF;
 PERFORM pg_advisory_xact_lock(1953744431,p_type);
 -- Select periods globally; hiding a level must not bring older periods back.
 WITH eligible AS MATERIALIZED (
  SELECT id,start_at,end_at FROM public.track_tournament
  WHERE type=p_type AND finalized_at IS NOT NULL AND overall_competitive
  ORDER BY end_at DESC,id DESC LIMIT CASE WHEN p_type=0 THEN 12 ELSE 6 END
 )
 INSERT INTO public.track_tournament_overall_period(type,eligible_event_count,period_start,period_end,last_updated_at)
 SELECT p_type,count(*)::integer,min(start_at),max(end_at),clock_timestamp() FROM eligible
 ON CONFLICT(type) DO UPDATE SET eligible_event_count=excluded.eligible_event_count,
 period_start=excluded.period_start,period_end=excluded.period_end,last_updated_at=excluded.last_updated_at;

 DELETE FROM public.track_tournament_overall_standing WHERE type=p_type;
 WITH eligible AS MATERIALIZED (
  SELECT id,id_level FROM public.track_tournament
  WHERE type=p_type AND finalized_at IS NOT NULL AND overall_competitive
  ORDER BY end_at DESC,id DESC LIMIT CASE WHEN p_type=0 THEN 12 ELSE 6 END
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

CREATE FUNCTION zc_private.tg_track_tournament_competitive() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.finalized_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.finalized_at IS NULL) THEN
  NEW.overall_competitive := coalesce(NEW.overall_competitive,EXISTS(
   SELECT 1 FROM public.track_tournament_result r WHERE r.id_tournament=NEW.id
  ));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER track_tournament_competitive BEFORE INSERT OR UPDATE ON public.track_tournament
 FOR EACH ROW EXECUTE FUNCTION zc_private.tg_track_tournament_competitive();

-- Statement transition tables avoid refreshing once per participant on cascades.
CREATE FUNCTION zc_private.tg_track_tournament_overall_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE kind integer;
BEGIN
 IF TG_OP='UPDATE' THEN
  FOR kind IN SELECT DISTINCT type FROM (
   SELECT n.type FROM new_events n JOIN old_events o USING(id)
   WHERE (n.finalized_at IS NOT NULL OR o.finalized_at IS NOT NULL)
    AND ROW(n.finalized_at,n.overall_competitive,n.end_at,n.start_at,n.id_level,n.type)
     IS DISTINCT FROM ROW(o.finalized_at,o.overall_competitive,o.end_at,o.start_at,o.id_level,o.type)
   UNION SELECT o.type FROM old_events o JOIN new_events n USING(id)
   WHERE o.finalized_at IS NOT NULL AND o.type<>n.type
  ) changed ORDER BY type LOOP PERFORM zc_private.refresh_track_tournament_overall(kind); END LOOP;
 ELSIF TG_OP='INSERT' THEN
  FOR kind IN SELECT DISTINCT type FROM new_events WHERE finalized_at IS NOT NULL ORDER BY type
  LOOP PERFORM zc_private.refresh_track_tournament_overall(kind); END LOOP;
 ELSE
  FOR kind IN SELECT DISTINCT type FROM old_events WHERE finalized_at IS NOT NULL ORDER BY type
  LOOP PERFORM zc_private.refresh_track_tournament_overall(kind); END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER track_tournament_overall_update AFTER UPDATE ON public.track_tournament
 REFERENCING OLD TABLE AS old_events NEW TABLE AS new_events FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_track_tournament_overall_events();
CREATE TRIGGER track_tournament_overall_insert AFTER INSERT ON public.track_tournament
 REFERENCING NEW TABLE AS new_events FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_track_tournament_overall_events();
CREATE TRIGGER track_tournament_overall_delete AFTER DELETE ON public.track_tournament
 REFERENCING OLD TABLE AS old_events FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_track_tournament_overall_events();

CREATE FUNCTION zc_private.tg_track_tournament_overall_results() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE kind integer;
BEGIN
 FOR kind IN SELECT DISTINCT t.type FROM old_results r JOIN public.track_tournament t ON t.id=r.id_tournament
 WHERE t.finalized_at IS NOT NULL ORDER BY t.type
 LOOP PERFORM zc_private.refresh_track_tournament_overall(kind); END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER track_tournament_overall_results_delete AFTER DELETE ON public.track_tournament_result
 REFERENCING OLD TABLE AS old_results FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_track_tournament_overall_results();

CREATE FUNCTION zc_private.tg_track_tournament_overall_visibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE kind integer;
BEGIN
 FOR kind IN SELECT DISTINCT t.type FROM public.track_tournament t
 JOIN new_levels n ON n.id=t.id_level JOIN old_levels o ON o.id=n.id
 WHERE n.publicly_visible IS DISTINCT FROM o.publicly_visible AND t.finalized_at IS NOT NULL ORDER BY t.type
 LOOP PERFORM zc_private.refresh_track_tournament_overall(kind); END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER track_tournament_overall_visibility AFTER UPDATE ON public.level
 REFERENCING OLD TABLE AS old_levels NEW TABLE AS new_levels FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_track_tournament_overall_visibility();

REVOKE ALL ON FUNCTION zc_private.tg_track_tournament_competitive(),zc_private.tg_track_tournament_overall_events(),zc_private.tg_track_tournament_overall_results(),zc_private.tg_track_tournament_overall_visibility() FROM PUBLIC,zeepcentraal_graphql;
SELECT zc_private.refresh_track_tournament_overall(0);
SELECT zc_private.refresh_track_tournament_overall(1);
