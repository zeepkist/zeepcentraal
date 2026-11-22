SELECT id,steam_name,banned,steam_id,discord_id FROM public."user" WHERE discord_id=$1 AND discord_id>0 LIMIT 1
