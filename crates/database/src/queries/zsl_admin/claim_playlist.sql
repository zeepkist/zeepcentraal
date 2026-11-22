UPDATE zc_private.zsl_playlist_revision revision
SET state = 'preparing', updated_at = clock_timestamp(), diagnostics = '[]'
WHERE id = $1 AND (state = 'queued' OR (state = 'preparing' AND updated_at < now() - interval '20 minutes'))
AND NOT EXISTS (SELECT FROM zc_private.zsl_playlist_revision newer
    WHERE newer.round_id = revision.round_id AND newer.kind = revision.kind AND newer.id > revision.id)
RETURNING id, round_id, kind, source, updated_at::text AS attempt
