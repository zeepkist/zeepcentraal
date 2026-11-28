SET LOCAL lock_timeout = '5s';

DROP VIEW public.lobby_listing;
ALTER TABLE public.lobby DROP COLUMN levels_played;

CREATE VIEW public.lobby_listing WITH (security_invoker=true) AS
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
 CASE WHEN is_public THEN game_state END AS game_state
FROM public.lobby;
COMMENT ON VIEW public.lobby_listing IS E'@primaryKey id\n@foreignKey (host_id) references public.user (steam_id)|@fieldName host\n@behavior -insert -update -delete';
GRANT SELECT ON public.lobby_listing TO zeepcentraal_graphql;
