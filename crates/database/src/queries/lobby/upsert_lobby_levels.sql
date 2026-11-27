WITH observations AS (
    SELECT room.id AS lobby_id, value.level_uid, value.workshop_id, value.level_name,
           value.level_author, value.author_id, value.round_time, value.game_state
    FROM jsonb_to_recordset($1) AS value(
        master_id text, level_uid text, workshop_id bigint, level_name text,
        level_author text, author_id bigint, round_time double precision, game_state integer
    )
    JOIN public.lobby room USING (master_id)
), upserted AS (
    INSERT INTO public.lobby_level (lobby_id, level_uid, workshop_id, level_item_id)
    SELECT observation.lobby_id, observation.level_uid, observation.workshop_id, item.id
    FROM observations observation
    LEFT JOIN LATERAL (
        SELECT item.id FROM public.level_item item JOIN public.level level ON level.id = item.id_level
        WHERE item.file_uid = observation.level_uid AND item.workshop_id = observation.workshop_id
          AND NOT item.deleted AND (observation.workshop_id <> 0 OR level.adventure)
        ORDER BY item.updated_at DESC, item.id DESC LIMIT 1
    ) item ON true
    WHERE observation.level_uid IS NOT NULL
    ON CONFLICT (lobby_id, level_uid, workshop_id)
    DO UPDATE SET level_item_id = excluded.level_item_id
    WHERE lobby_level.level_item_id IS DISTINCT FROM excluded.level_item_id
)
UPDATE public.lobby room
SET current_level_uid = observation.level_uid, level_name = observation.level_name,
    level_author = observation.level_author, level_workshop_id = observation.workshop_id,
    level_author_steam_id = observation.author_id, round_time = observation.round_time,
    game_state = observation.game_state
FROM observations observation
WHERE room.id = observation.lobby_id
  AND ROW(room.current_level_uid, room.level_name, room.level_author, room.level_workshop_id,
          room.level_author_steam_id, room.round_time, room.game_state)
      IS DISTINCT FROM ROW(observation.level_uid, observation.level_name, observation.level_author,
          observation.workshop_id, observation.author_id, observation.round_time, observation.game_state)
