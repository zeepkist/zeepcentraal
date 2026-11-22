UPDATE zc_private.level_submissions SET inspection_started_at=NULL,retry_category=NULL,next_inspection_at=now()+interval '30 minutes' WHERE id=$1 AND revision=$2 AND state='selected'
