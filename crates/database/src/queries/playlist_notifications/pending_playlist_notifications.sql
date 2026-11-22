SELECT jsonb_build_object('contestId',n.id_contest,'playlistId',n.desired_playlist_id,
            'deliveredPlaylistId',n.delivered_playlist_id,'messageId',n.message_id,'channelId',n.channel_id,
            'attemptPlaylistId',n.attempt_playlist_id,'attemptChannelId',n.attempt_channel_id,
            'name',r.name,'validCount',p.valid_count,'objectKey',p.object_key,'digest',p.digest) AS payload
            FROM zc_private.level_submission_playlist_notification n
            JOIN zc_private.level_submission_contest c ON c.id=n.id_contest
            JOIN public.zsl_round r ON r.id=c.id_zsl_round
            JOIN zc_private.level_submission_playlist p ON p.id=n.desired_playlist_id
            WHERE c.id_zsl_round=ANY($1) AND n.next_attempt_at<=now() AND
                (n.delivered_playlist_id IS DISTINCT FROM n.desired_playlist_id OR n.channel_id IS DISTINCT FROM $2 OR n.attempt_started_at IS NOT NULL)
            ORDER BY n.next_attempt_at,n.id_contest
