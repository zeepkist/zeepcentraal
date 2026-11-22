SELECT count(*) FROM streamkist.channels WHERE guild_id=$1 AND channel_id=$2 AND game_id=$3 AND deleted_at IS NULL
