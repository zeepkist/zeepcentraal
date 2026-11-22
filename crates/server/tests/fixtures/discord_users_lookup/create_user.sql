
        CREATE TABLE IF NOT EXISTS public."user" (id integer PRIMARY KEY, steam_id bigint, steam_name varchar(255), discord_id bigint);
        CREATE TABLE IF NOT EXISTS public.user_points (id_user integer PRIMARY KEY, points integer);
        INSERT INTO public."user"(id,steam_name,discord_id) VALUES
            (9001,'Fixture player',123456789012345678),(9002,NULL,NULL)
            ON CONFLICT(id) DO UPDATE SET steam_name=excluded.steam_name,discord_id=excluded.discord_id;
        INSERT INTO public.user_points(id_user,points) VALUES(9001,123000)
            ON CONFLICT(id_user) DO UPDATE SET points=excluded.points;
