SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Existing filters/orderBy cannot express column comparisons or elapsed seconds.
-- Reuse generated view connections and pg-aggregates for everything else.
CREATE VIEW public.lobby_listing WITH (security_invoker=true) AS
SELECT id, room_name, host_id, players, player_limit, is_public, peak_players,
 peak_time, first_seen, last_seen, closed_at,
 extract(epoch FROM coalesce(closed_at,last_seen)-first_seen)::double precision AS duration_seconds,
 CASE WHEN player_limit>0 THEN players::double precision/player_limit END AS occupancy,
 players<player_limit AS available_capacity
FROM public.lobby;
COMMENT ON VIEW public.lobby_listing IS E'@primaryKey id\n@foreignKey (host_id) references public.user (steam_id)|@fieldName host\n@behavior -insert -update -delete';
GRANT SELECT ON public.lobby_listing TO zeepcentraal_graphql;

-- pg-aggregates cannot retain temporal endpoints and capacity extrema together
-- while bounding a long room timeline. Events remain separately paginated.
CREATE FUNCTION public.lobby_occupancy_timeline(p_lobby_id bigint, p_buckets integer DEFAULT 200)
RETURNS TABLE(bucket_start timestamptz, first_observed_at timestamptz, last_observed_at timestamptz,
 first_players integer, last_players integer, min_players integer, max_players integer,
 first_capacity integer, last_capacity integer, min_capacity integer, max_capacity integer,
 observation_count bigint, has_gap boolean, has_closure boolean, has_reopening boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 WITH bounds AS (
  SELECT min(observed_at) AS start_at,max(observed_at) AS end_at
  FROM public.lobby_history WHERE lobby_id=p_lobby_id
 ), samples AS (
  SELECT h.*, lag(observed_at) OVER (ORDER BY observed_at,id) AS previous_at,
   floor(extract(epoch FROM h.observed_at-b.start_at)/greatest(1,
    extract(epoch FROM b.end_at-b.start_at)/greatest(1,least(coalesce(p_buckets,200),200))))::integer AS bucket
  FROM public.lobby_history h CROSS JOIN bounds b WHERE lobby_id=p_lobby_id
 )
 SELECT min(observed_at),min(observed_at),max(observed_at),
  (array_agg(players ORDER BY observed_at,id))[1],(array_agg(players ORDER BY observed_at DESC,id DESC))[1],
  min(players),max(players),
  (array_agg(player_limit ORDER BY observed_at,id))[1],(array_agg(player_limit ORDER BY observed_at DESC,id DESC))[1],
  min(player_limit),max(player_limit),count(*),
  bool_or(observed_at-previous_at>interval '5 minutes'),
  bool_or(change_type='closed'),bool_or(change_type='reopened')
 FROM samples GROUP BY bucket ORDER BY bucket
$$;
REVOKE ALL ON FUNCTION public.lobby_occupancy_timeline(bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lobby_occupancy_timeline(bigint,integer) TO zeepcentraal_graphql;
COMMENT ON FUNCTION public.lobby_occupancy_timeline(bigint,integer) IS 'Bounded last-observed room occupancy. At most 201 buckets. Gaps do not prove downtime.';

CREATE TRIGGER trg__live_query_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.lobby
 FOR EACH STATEMENT EXECUTE FUNCTION public.tg__live_query_invalidate();
CREATE TRIGGER trg__live_query_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.lobby_history
 FOR EACH STATEMENT EXECUTE FUNCTION public.tg__live_query_invalidate();
CREATE TRIGGER trg__live_query_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.lobby_stats
 FOR EACH STATEMENT EXECUTE FUNCTION public.tg__live_query_invalidate();
