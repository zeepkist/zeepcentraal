SELECT id_user,expires_at<=clock_timestamp() AS expired, consumed_at IS NOT NULL AS consumed FROM zc_private.discord_oauth_link_state WHERE state_hash=$1 FOR UPDATE
