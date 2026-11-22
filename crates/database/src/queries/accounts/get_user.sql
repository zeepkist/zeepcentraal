SELECT id,steam_name,banned,steam_id,discord_id FROM public."user" WHERE steam_id=$1 LIMIT 1
