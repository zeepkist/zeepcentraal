
        INSERT INTO public."user"(id,steam_id) VALUES(1,42);
        INSERT INTO public.level(id,xx_hash) VALUES(1,repeat('a',32));
        INSERT INTO public.record(id,id_user,id_level,time) SELECT id,1,1,10 FROM generate_series(1,8) id;
        INSERT INTO public.record_statistic(id_record,ghost_version,distance_on_ground,time_on_ground,distance_on_wood,time_on_wood,date_created)
        VALUES (1,7,100,10,20,2,'2020-01-01'),(2,8,100,10,200,20,'2020-01-01'),
               (3,6,100,10,20,2,'2020-01-01'),(4,8,NULL,NULL,NULL,NULL,'2020-01-01'),
               (5,8,100,NULL,20,NULL,'2020-01-01'),(6,7,100,10,NULL,NULL,'2020-01-01');
        UPDATE public.record_statistic SET time_on_unknown=7 WHERE id_record=6;
