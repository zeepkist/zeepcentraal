INSERT INTO zc_private.discord_oauth_link_state (state_hash,id_user,expires_at) VALUES($1,$2,clock_timestamp()+interval '5 minutes')
