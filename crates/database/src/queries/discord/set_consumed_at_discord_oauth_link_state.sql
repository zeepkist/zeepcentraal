UPDATE zc_private.discord_oauth_link_state SET consumed_at=clock_timestamp() WHERE state_hash=$1
