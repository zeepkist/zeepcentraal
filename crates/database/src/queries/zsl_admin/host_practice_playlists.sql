SELECT id, kind, state, bundle AS value, floor(extract(epoch FROM updated_at))::bigint AS updated_epoch
FROM zc_private.zsl_playlist_revision
WHERE round_id = $1 AND kind = 'practice'
AND (state = 'verified' OR id = (SELECT max(id) FROM zc_private.zsl_playlist_revision WHERE round_id = $1 AND kind = 'practice'))
ORDER BY id DESC LIMIT 2
