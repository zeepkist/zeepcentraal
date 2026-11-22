UPDATE zc_private.discord_rank_batch_state SET changes=$1, window_started_at=to_timestamp($2::bigint::double precision/1000), last_change_at=to_timestamp($3::bigint::double precision/1000) WHERE id=1
