INSERT INTO public."user" (id,steam_id,steam_name,discord_id) VALUES(900001,76561198000000001,'Fake supporter',NULL);
UPDATE public."user" SET discord_id=12345678901234567 WHERE id=900001;
