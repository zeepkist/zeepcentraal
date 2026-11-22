SELECT source AS value FROM zc_private.zsl_playlist_revision
WHERE round_id = $1 AND kind = 'tournament' AND source IS NOT NULL
ORDER BY id DESC LIMIT 1
