INSERT INTO public."user" (steam_id,steam_name,discord_id,banned,date_created,date_updated) VALUES($1,'Unknown',-1,false,clock_timestamp(),clock_timestamp()) ON CONFLICT (steam_id) DO NOTHING
