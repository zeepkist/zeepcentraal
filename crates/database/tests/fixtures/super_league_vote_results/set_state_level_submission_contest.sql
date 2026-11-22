UPDATE zc_private.level_submission_contest SET state='frozen',current_playlist_id=$2,finalized_at=now(),archive_object_key='fixture',archive_sha256=repeat('a',64),archive_size=1 WHERE id=$1
