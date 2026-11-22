UPDATE zc_private.level_submissions SET retry_category=$3,inspection_started_at=NULL,next_inspection_at=now()+interval '60 seconds' WHERE id=$1 AND revision=$2 AND state='selected'
