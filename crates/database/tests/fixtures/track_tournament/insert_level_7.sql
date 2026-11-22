INSERT INTO public.level(publicly_visible,date_created)
             VALUES (true,'2026-10-31'),(true,'2020-01-01');
             INSERT INTO public.level_points VALUES (1,10),(2,1000);
             INSERT INTO public.level_item(id_level,publicly_visible,deleted)
             SELECT id,true,false FROM public.level
