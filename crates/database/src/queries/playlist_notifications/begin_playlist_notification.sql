UPDATE zc_private.level_submission_playlist_notification SET attempt_playlist_id=$2,attempt_channel_id=$3,attempt_started_at=now() WHERE id_contest=$1 AND attempt_started_at IS NULL
