SELECT EXISTS (
    SELECT FROM zc_private.zsl_tournament_state WHERE id_round = $1 AND state->'pinned' <> 'null'::jsonb
    AND (state->'started' @> '[true]'::jsonb OR state->>'phase' = 'tournament'
        OR coalesce((state->'progress'->>0)::integer, 0) > 0
        OR coalesce((state->'progress'->>1)::integer, 0) > 0)
) AS locked
