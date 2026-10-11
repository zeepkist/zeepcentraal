CREATE TABLE zc_private.level_submission_playlist_notification (
    id_contest bigint PRIMARY KEY REFERENCES zc_private.level_submission_contest(id) ON DELETE CASCADE,
    desired_playlist_id bigint NOT NULL REFERENCES zc_private.level_submission_playlist(id),
    delivered_playlist_id bigint REFERENCES zc_private.level_submission_playlist(id),
    message_id text,
    channel_id text,
    attempt_playlist_id bigint REFERENCES zc_private.level_submission_playlist(id),
    attempt_channel_id text,
    attempt_started_at timestamptz,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((message_id IS NULL) OR (channel_id IS NOT NULL)),
    CHECK ((attempt_started_at IS NULL AND attempt_playlist_id IS NULL AND attempt_channel_id IS NULL)
        OR (attempt_started_at IS NOT NULL AND attempt_playlist_id IS NOT NULL AND attempt_channel_id IS NOT NULL))
);
CREATE INDEX submission_playlist_notification_due ON zc_private.level_submission_playlist_notification(next_attempt_at);
