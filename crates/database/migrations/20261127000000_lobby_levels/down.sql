DROP VIEW public.lobby_listing;
ALTER TABLE public.lobby
    DROP COLUMN current_level_uid,
    DROP COLUMN level_name,
    DROP COLUMN level_author,
    DROP COLUMN level_workshop_id,
    DROP COLUMN level_author_steam_id,
    DROP COLUMN round_time,
    DROP COLUMN game_state;
DROP TABLE public.lobby_level;

CREATE VIEW public.lobby_listing WITH (security_invoker=true) AS
SELECT id, room_name, host_id, players, player_limit, is_public, peak_players,
 peak_time, first_seen, last_seen, closed_at,
 extract(epoch FROM coalesce(closed_at,last_seen)-first_seen)::double precision AS duration_seconds,
 CASE WHEN player_limit>0 THEN players::double precision/player_limit END AS occupancy,
 players<player_limit AS available_capacity
FROM public.lobby;
COMMENT ON VIEW public.lobby_listing IS E'@primaryKey id\n@foreignKey (host_id) references public.user (steam_id)|@fieldName host\n@behavior -insert -update -delete';
GRANT SELECT ON public.lobby_listing TO zeepcentraal_graphql;
