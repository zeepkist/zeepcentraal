SELECT id_user,expires_at<=clock_timestamp() AS expired, consumed_at IS NOT NULL AS consumed FROM zc_private.discord_link_code WHERE code_hash=$1 FOR UPDATE
