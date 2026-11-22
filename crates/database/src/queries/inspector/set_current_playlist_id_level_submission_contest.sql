UPDATE zc_private.level_submission_contest SET current_playlist_id=$2,published_revision=playlist_revision, date_updated=clock_timestamp() WHERE id=$1
