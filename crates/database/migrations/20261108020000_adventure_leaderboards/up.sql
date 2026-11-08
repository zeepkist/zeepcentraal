SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Same numbered item names as Adventure pages. One canonical level can belong
-- to several series, but never contributes twice within one scope.
CREATE VIEW public.adventure_level_membership WITH (security_invoker=true) AS
SELECT DISTINCT lower(split_part(i.name,'-',1)) AS series, l.id AS id_level
FROM public.level l JOIN public.level_item i ON i.id_level=l.id
WHERE l.adventure AND l.publicly_visible AND NOT i.deleted
 AND i.name ~* '^(A|B|C|CL|D|E|EZ|F|FL|G|H|I|L|OR|X|XG|Y)-[0-9]+$';
COMMENT ON VIEW public.adventure_level_membership IS E'@primaryKey series,id_level\n@foreignKey (id_level) references public.level (id)\n@behavior -insert -update -delete';

CREATE VIEW public.adventure_leaderboard_scope WITH (security_invoker=true) AS
WITH scopes AS (SELECT unnest(ARRAY['','a','b','c','cl','d','e','ez','f','fl','g','h','i','l','or','x','xg','y']) AS series)
SELECT s.series, count(DISTINCT m.id_level)::integer AS total_levels
FROM scopes s LEFT JOIN public.adventure_level_membership m ON s.series='' OR m.series=s.series
GROUP BY s.series;
COMMENT ON VIEW public.adventure_leaderboard_scope IS E'@primaryKey series\n@behavior -insert -update -delete';

CREATE VIEW public.adventure_leaderboard_entry WITH (security_invoker=true) AS
WITH membership AS (
 SELECT series,id_level FROM public.adventure_level_membership
 UNION SELECT '',id_level FROM public.adventure_level_membership
), totals AS (
 SELECT m.series,pb.id_user,count(*)::integer AS completed_levels,
  sum(floor(r.time::double precision*1000+0.5)::bigint)::bigint AS total_time_ms,
  array_agg(m.id_level ORDER BY m.id_level) AS completed_level_ids
 FROM membership m JOIN public.personal_best_global pb ON pb.id_level=m.id_level AND pb.record_eligible
 JOIN public.record r ON r.id=pb.id_record AND r.record_eligible
 JOIN public."user" u ON u.id=pb.id_user AND NOT u.banned
 GROUP BY m.series,pb.id_user
)
SELECT t.series,t.id_user,t.completed_levels,s.total_levels,
 s.total_levels-t.completed_levels AS remaining_levels,t.total_time_ms,
 t.completed_levels=s.total_levels AS is_complete,t.completed_level_ids,
 rank() OVER(PARTITION BY t.series ORDER BY t.completed_levels DESC,t.total_time_ms)::integer AS rank
FROM totals t JOIN public.adventure_leaderboard_scope s USING(series);
COMMENT ON VIEW public.adventure_leaderboard_entry IS E'@primaryKey series,id_user\n@foreignKey (id_user) references public."user" (id)\n@behavior -insert -update -delete';
COMMENT ON COLUMN public.adventure_leaderboard_entry.completed_level_ids IS E'@omit';

CREATE FUNCTION public.adventure_leaderboard(series text DEFAULT NULL)
RETURNS public.adventure_leaderboard_scope LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE result public.adventure_leaderboard_scope;
BEGIN
 SELECT s.* INTO result FROM public.adventure_leaderboard_scope s WHERE s.series=coalesce(lower(adventure_leaderboard.series),'');
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown Adventure series' USING ERRCODE='22023'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.adventure_leaderboard_scope_entries(scope public.adventure_leaderboard_scope)
RETURNS SETOF public.adventure_leaderboard_entry LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT e.* FROM public.adventure_leaderboard_entry e WHERE e.series=scope.series
 ORDER BY e.completed_levels DESC,e.total_time_ms,e.id_user
$$;
CREATE FUNCTION public.adventure_leaderboard_scope_total_players(scope public.adventure_leaderboard_scope)
RETURNS integer LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT count(*)::integer FROM public.adventure_leaderboard_entry e WHERE e.series=scope.series
$$;
CREATE FUNCTION public.adventure_leaderboard_scope_player_entry(scope public.adventure_leaderboard_scope,user_id integer)
RETURNS public.adventure_leaderboard_entry LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT e.* FROM public.adventure_leaderboard_entry e WHERE e.series=scope.series AND e.id_user=user_id
$$;
CREATE FUNCTION public.adventure_leaderboard_scope_missing_levels(scope public.adventure_leaderboard_scope,user_id integer)
RETURNS SETOF public.level LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT l.* FROM public.level l WHERE EXISTS(
  SELECT 1 FROM public.adventure_level_membership m WHERE m.id_level=l.id AND (scope.series='' OR m.series=scope.series)
 ) AND NOT EXISTS(
  SELECT 1 FROM public.personal_best_global pb JOIN public.record r ON r.id=pb.id_record AND r.record_eligible
  JOIN public."user" u ON u.id=pb.id_user AND NOT u.banned
  WHERE pb.id_user=user_id AND pb.id_level=l.id AND pb.record_eligible
 ) ORDER BY l.id
$$;
CREATE FUNCTION public.adventure_leaderboard_entry_next_entry(entry public.adventure_leaderboard_entry)
RETURNS public.adventure_leaderboard_entry LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT e.* FROM public.adventure_leaderboard_entry e WHERE e.series=entry.series AND e.rank<entry.rank
 ORDER BY e.rank DESC,e.id_user LIMIT 1
$$;
CREATE FUNCTION public.adventure_leaderboard_entry_gap_ms(entry public.adventure_leaderboard_entry)
RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT entry.total_time_ms-e.total_time_ms FROM public.adventure_leaderboard_entry_next_entry(entry) e
 WHERE e.completed_level_ids=entry.completed_level_ids
$$;

REVOKE ALL ON public.adventure_level_membership,public.adventure_leaderboard_scope,public.adventure_leaderboard_entry FROM PUBLIC;
GRANT SELECT ON public.adventure_level_membership,public.adventure_leaderboard_scope,public.adventure_leaderboard_entry TO zeepcentraal_graphql;
DO $$ DECLARE f regprocedure; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND (p.proname='adventure_leaderboard' OR p.proname LIKE 'adventure_leaderboard_scope_%' OR p.proname LIKE 'adventure_leaderboard_entry_%')
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO zeepcentraal_graphql',f);
 END LOOP;
END $$;
-- Base tables already emit statement invalidations for PB, record eligibility,
-- user bans, level visibility and item mapping changes. Views need no cache.
