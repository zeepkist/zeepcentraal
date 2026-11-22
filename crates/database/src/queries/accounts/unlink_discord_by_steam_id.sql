UPDATE public."user" SET discord_id=-1,date_updated=clock_timestamp() WHERE steam_id=$1
