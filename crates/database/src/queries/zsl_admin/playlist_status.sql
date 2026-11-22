SELECT jsonb_build_object(
    'playlists', coalesce(jsonb_agg(status ORDER BY kind), '[]'),
    'tournamentPinned', EXISTS (SELECT FROM zc_private.zsl_tournament_state
        WHERE id_round = $1 AND state->'pinned' <> 'null'::jsonb
        AND (state->'started' @> '[true]'::jsonb OR state->>'phase' = 'tournament'
            OR coalesce((state->'progress'->>0)::integer, 0) > 0
            OR coalesce((state->'progress'->>1)::integer, 0) > 0)),
    'alerts', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'timeslot', timeslot, 'startsAt', starts_at, 'hours', hours
    ) ORDER BY starts_at, hours DESC), '[]') FROM zc_private.zsl_readiness_alert WHERE round_id = $1)
) AS value
FROM (
    SELECT selected.kind, jsonb_build_object(
        'kind', selected.kind, 'selectedRevision', selected.id, 'state', selected.state, 'updatedAt', selected.updated_at,
        'diagnostics', selected.diagnostics,
        'verifiedRevision', verified.id, 'verifiedLevels', (
            SELECT coalesce(jsonb_agg(jsonb_build_object('uid', entry->'level'->>'UID',
                'name', entry->'level'->>'Name', 'workshopId', entry->'level'->>'WorkshopID')
                ORDER BY position), '[]')
            FROM jsonb_array_elements(verified.bundle->'levels') WITH ORDINALITY AS levels(entry, position)
        )
    ) AS status
    FROM (SELECT DISTINCT ON (kind) * FROM zc_private.zsl_playlist_revision
        WHERE round_id = $1 ORDER BY kind, id DESC) selected
    LEFT JOIN LATERAL (
        SELECT id, bundle FROM zc_private.zsl_playlist_revision saved
        WHERE saved.round_id = $1 AND saved.kind = selected.kind AND saved.state = 'verified'
        ORDER BY id DESC LIMIT 1
    ) verified ON true
) playlists
