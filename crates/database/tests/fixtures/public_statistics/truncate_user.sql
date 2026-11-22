TRUNCATE public."user" RESTART IDENTITY CASCADE;
         INSERT INTO public."user"(id,steam_id,banned) OVERRIDING SYSTEM VALUE
         VALUES(1,101,false),(2,102,true),(3,103,false),(4,104,false)
