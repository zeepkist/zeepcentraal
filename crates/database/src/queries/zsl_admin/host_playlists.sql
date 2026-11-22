SELECT DISTINCT ON (kind) id, kind, state, bundle AS value, floor(extract(epoch FROM updated_at))::bigint AS updated_epoch
FROM zc_private.zsl_playlist_revision WHERE round_id = $1 AND kind IN ('warmup', 'tournament')
AND (state = 'verified' OR ($2 AND NOT EXISTS (SELECT FROM zc_private.zsl_playlist_revision newer
    WHERE newer.round_id = $1 AND newer.kind = zsl_playlist_revision.kind AND newer.id > zsl_playlist_revision.id)))
ORDER BY kind, id DESC
