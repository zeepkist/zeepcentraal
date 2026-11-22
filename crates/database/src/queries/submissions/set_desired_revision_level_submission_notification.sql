UPDATE zc_private.level_submission_notification n SET desired_revision=s.revision,next_attempt_at=now(),date_updated=now() FROM zc_private.level_submissions s WHERE n.id_submission=s.id AND s.id=$1
