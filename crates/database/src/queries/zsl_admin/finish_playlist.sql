UPDATE zc_private.zsl_playlist_revision revision
SET state = CASE WHEN $3::jsonb IS NULL THEN 'failed' ELSE 'prepared' END,
    bundle = $3, diagnostics = $4, updated_at = clock_timestamp()
WHERE id = $1 AND state = 'preparing' AND updated_at = $2::timestamptz
AND NOT EXISTS (SELECT FROM zc_private.zsl_playlist_revision newer
    WHERE newer.round_id = revision.round_id AND newer.kind = revision.kind AND newer.id > revision.id)
