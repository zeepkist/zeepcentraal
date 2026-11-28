SELECT
    room.players, room.player_limit, room.peak_players,
    private_room.players AS private_players,
    private_room.player_limit AS private_player_limit,
    private_room.peak_players AS private_peak_players,
    (SELECT array_agg(ARRAY[players, players_in_rooms] ORDER BY date_created)::text
     FROM public.lobby_stats
     WHERE date_created BETWEEN '2026-09-20T12:11:00Z' AND '2026-09-20T12:12:00Z') AS stats,
    (SELECT array_agg(ARRAY[players, player_limit] ORDER BY id)::text
     FROM public.lobby_history WHERE lobby_id = room.id) AS history
FROM public.lobby room, public.lobby private_room
WHERE room.master_id = $1 AND private_room.master_id = $2
