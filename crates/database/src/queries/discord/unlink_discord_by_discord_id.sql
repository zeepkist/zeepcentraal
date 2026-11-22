UPDATE public."user" SET discord_id=-1,date_updated=clock_timestamp() WHERE discord_id=$1 RETURNING id AS id_user,discord_id
