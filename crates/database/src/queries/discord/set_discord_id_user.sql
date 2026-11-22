UPDATE public."user" SET discord_id=$2,date_updated=clock_timestamp() WHERE id=$1 AND (discord_id IS NULL OR discord_id=-1 OR discord_id=$2) RETURNING id AS id_user,steam_id
