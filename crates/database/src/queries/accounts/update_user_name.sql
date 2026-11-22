UPDATE public."user" SET steam_name=$2,date_updated=clock_timestamp() WHERE steam_id=$1
