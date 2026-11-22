INSERT INTO zc_private.zsl_playlist_revision (round_id, kind, source)
SELECT round_id, kind, source FROM zc_private.zsl_playlist_revision revision
WHERE id = $1 AND round_id = $2 AND state = 'failed'
AND NOT EXISTS (SELECT FROM zc_private.zsl_playlist_revision newer
    WHERE newer.round_id = revision.round_id AND newer.kind = revision.kind AND newer.id > revision.id)
RETURNING id, kind
