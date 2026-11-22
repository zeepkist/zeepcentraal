SELECT id FROM zc_private.zsl_playlist_revision revision
WHERE (state = 'queued' OR (state = 'preparing' AND updated_at < now() - interval '20 minutes'))
AND NOT EXISTS (SELECT FROM zc_private.zsl_playlist_revision newer
    WHERE newer.round_id = revision.round_id AND newer.kind = revision.kind AND newer.id > revision.id)
ORDER BY id LIMIT 100
