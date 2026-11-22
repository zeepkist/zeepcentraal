UPDATE zc_private.discord_link_code SET consumed_at=clock_timestamp() WHERE code_hash=$1
