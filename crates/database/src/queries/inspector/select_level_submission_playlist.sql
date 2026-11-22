SELECT to_jsonb(level_submission_playlist.*) AS payload FROM zc_private.level_submission_playlist WHERE id=$1
