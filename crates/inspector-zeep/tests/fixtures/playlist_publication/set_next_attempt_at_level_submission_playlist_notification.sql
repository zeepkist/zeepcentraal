UPDATE zc_private.level_submission_playlist_notification SET next_attempt_at=now() WHERE id_contest=$1
