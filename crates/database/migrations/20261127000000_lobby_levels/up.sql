SET LOCAL lock_timeout = '5s';

CREATE TABLE public.lobby_level (
    lobby_id bigint NOT NULL REFERENCES public.lobby(id) ON DELETE CASCADE,
    level_uid text NOT NULL,
    workshop_id bigint NOT NULL CHECK (workshop_id >= 0),
    level_item_id integer REFERENCES public.level_item(id) ON DELETE SET NULL,
    scan_requested_at timestamptz,
    PRIMARY KEY (lobby_id, level_uid, workshop_id)
);
CREATE INDEX lobby_level_pending_workshop ON public.lobby_level (workshop_id, scan_requested_at)
    WHERE level_item_id IS NULL AND workshop_id > 0;
CREATE INDEX lobby_level_level_item_id ON public.lobby_level (level_item_id);
COMMENT ON TABLE public.lobby_level IS E'@omit';

ALTER TABLE public.lobby
    ADD COLUMN current_level_uid text,
    ADD COLUMN level_name text,
    ADD COLUMN level_author text,
    ADD COLUMN level_workshop_id bigint,
    ADD COLUMN level_author_steam_id bigint,
    ADD COLUMN round_time double precision CHECK (round_time > 0 AND round_time < 'Infinity'::double precision),
    ADD COLUMN game_state integer,
    ADD CONSTRAINT lobby_current_level_fkey
        FOREIGN KEY (id, current_level_uid, level_workshop_id)
        REFERENCES public.lobby_level (lobby_id, level_uid, workshop_id);
COMMENT ON COLUMN public.lobby.current_level_uid IS E'@omit';
GRANT SELECT (level_name, level_author, level_workshop_id, level_author_steam_id, round_time, game_state)
    ON public.lobby TO zeepcentraal_graphql;

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
 CASE WHEN is_public THEN game_state END AS game_state
FROM public.lobby;
COMMENT ON VIEW public.lobby_listing IS E'@primaryKey id\n@foreignKey (host_id) references public.user (steam_id)|@fieldName host\n@behavior -insert -update -delete';
GRANT SELECT ON public.lobby_listing TO zeepcentraal_graphql;
