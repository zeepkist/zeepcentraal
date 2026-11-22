INSERT INTO public."user"(steam_id,steam_name) VALUES($1,$2) ON CONFLICT(steam_id) DO NOTHING
