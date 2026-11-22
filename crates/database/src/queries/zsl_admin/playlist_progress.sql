UPDATE zc_private.zsl_playlist_revision
SET diagnostics = $3
WHERE id = $1 AND state = 'preparing' AND updated_at = $2::timestamptz
