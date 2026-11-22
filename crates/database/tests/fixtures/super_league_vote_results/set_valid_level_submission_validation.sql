UPDATE zc_private.level_submission_validation SET valid=false WHERE id IN (SELECT id_validation FROM zc_private.level_submission_playlist_entry WHERE id_playlist=$1)
