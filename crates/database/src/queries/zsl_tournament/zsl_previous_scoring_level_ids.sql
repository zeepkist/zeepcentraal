SELECT DISTINCT id_level AS id
FROM zc_private.zsl_tournament_level_state
WHERE id_round = $1 AND timeslot = $2 AND playlist_index < $3 AND id_level IS NOT NULL
