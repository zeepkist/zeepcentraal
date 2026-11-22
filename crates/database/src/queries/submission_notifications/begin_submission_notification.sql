UPDATE zc_private.level_submission_notification SET attempt_started_at=coalesce(attempt_started_at,now()) WHERE id_submission=$1
