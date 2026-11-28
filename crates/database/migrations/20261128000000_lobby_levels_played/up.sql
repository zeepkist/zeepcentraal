SET LOCAL lock_timeout = '5s';

ALTER TABLE public.lobby ADD COLUMN levels_played bigint NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.lobby.levels_played IS E'@omit\n@behavior -aggregate -aggregate:filterBy -aggregate:orderBy -havingBy';
GRANT SELECT (levels_played) ON public.lobby TO zeepcentraal_graphql;

CREATE OR REPLACE VIEW public.lobby_listing WITH (security_invoker=true) AS
SELECT id, room_name, host_id, players, player_limit, is_public, peak_players,
 peak_time, first_seen, last_seen, closed_at,
 extract(epoch FROM coalesce(closed_at,last_seen)-first_seen)::double precision AS duration_seconds,
 CASE WHEN player_limit>0 THEN players::double precision/player_limit END AS occupancy,
 players<player_limit AS available_capacity,
 CASE WHEN is_public THEN level_name END AS level_name,
 CASE WHEN is_public THEN level_author END AS level_author,
 CASE WHEN is_public THEN level_workshop_id END AS level_workshop_id,
 CASE WHEN is_public THEN level_author_steam_id END AS level_author_steam_id,
 CASE WHEN is_public THEN round_time END AS round_time,
 CASE WHEN is_public THEN game_state END AS game_state,
 CASE WHEN is_public THEN levels_played END AS levels_played
FROM public.lobby;
