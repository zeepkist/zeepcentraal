UPDATE zc_private.level_submissions SET revision=revision+1,latest_validation_id=NULL,next_inspection_at=now(),inspection_started_at=NULL WHERE id_contest=$1 AND state='selected'
