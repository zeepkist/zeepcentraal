UPDATE zc_private.level_submission_notification SET next_attempt_at=now() WHERE id_submission=$1
