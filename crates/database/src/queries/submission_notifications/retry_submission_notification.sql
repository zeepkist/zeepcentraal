UPDATE zc_private.level_submission_notification SET next_attempt_at=now()+($2 * interval '1 second'),last_error='delivery-transient',date_updated=now() WHERE id_submission=$1
