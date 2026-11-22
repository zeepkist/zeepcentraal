UPDATE zc_private.level_submission_playlist_notification SET next_attempt_at=now()+($2 * interval '1 second') WHERE id_contest=$1
