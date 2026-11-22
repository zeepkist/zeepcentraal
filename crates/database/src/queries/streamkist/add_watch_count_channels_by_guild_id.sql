SELECT count(*) FROM streamkist.channels WHERE guild_id=$1 AND deleted_at IS NULL
