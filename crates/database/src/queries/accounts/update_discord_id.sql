UPDATE public."user" SET discord_id=$2,date_updated=clock_timestamp() WHERE steam_id=$1
