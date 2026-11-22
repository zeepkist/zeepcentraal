SELECT id,steam_id::bigint,steam_name::text FROM public."user" WHERE steam_id=ANY($1)
