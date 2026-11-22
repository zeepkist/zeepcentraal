UPDATE zc_private.discord_rank_batch_state SET window_started_at=clock_timestamp()-interval '3 minutes',last_change_at=clock_timestamp()-interval '2 minutes' WHERE changes<>'[]'::jsonb
