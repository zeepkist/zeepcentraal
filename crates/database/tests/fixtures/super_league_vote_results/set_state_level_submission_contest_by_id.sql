UPDATE zc_private.level_submission_contest SET state='open',finalized_at=NULL,archive_object_key=NULL,archive_sha256=NULL,archive_size=NULL WHERE id=$1
