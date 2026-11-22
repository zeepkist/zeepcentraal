INSERT INTO public.level(publicly_visible,date_created)
                 SELECT true,'2026-10-31' FROM generate_series(1,2002);
                 INSERT INTO public.level_points
                 SELECT id,CASE WHEN id=2002 THEN 1000000 ELSE id END FROM public.level;
                 INSERT INTO public.level_item(id_level,publicly_visible,deleted)
                 SELECT id,true,false FROM public.level
