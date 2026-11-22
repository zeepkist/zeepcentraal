INSERT INTO zc_private.zsl_playlist_revision (round_id, kind, source)
VALUES ($1, $2, $3) RETURNING id
