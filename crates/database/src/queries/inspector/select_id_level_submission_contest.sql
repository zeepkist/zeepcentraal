SELECT id FROM zc_private.level_submission_contest WHERE id=$1 AND state='open' AND playlist_revision=$2 FOR UPDATE
