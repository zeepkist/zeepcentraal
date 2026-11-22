SELECT discord_id,ping_on_world_record_loss, to_char(date_updated AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS date_updated FROM zc_private.discord_user_preference WHERE discord_id=$1
