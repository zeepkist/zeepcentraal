UPDATE streamkist.channels SET deleted_at=now() WHERE guild_id=$1 AND id=$2 AND deleted_at IS NULL
