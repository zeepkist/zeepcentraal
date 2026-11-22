UPDATE zc_private.discord_rank_batch_state SET window_started_at=clock_timestamp()-interval '5 minutes',last_change_at=clock_timestamp()
