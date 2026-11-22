UPDATE zc_private.zsl_playlist_revision revision
SET state = CASE WHEN $2::jsonb IS NULL THEN 'verified' ELSE 'failed' END,
    diagnostics = CASE WHEN $2::jsonb IS NULL THEN diagnostics ELSE diagnostics || $2 END,
    updated_at = clock_timestamp()
WHERE id = $1 AND (
    (state = 'prepared' AND NOT EXISTS (SELECT FROM zc_private.zsl_playlist_revision newer
        WHERE newer.round_id = revision.round_id AND newer.kind = revision.kind AND newer.id > revision.id))
    OR (state = 'verified' AND $2::jsonb IS NOT NULL)
)
