INSERT INTO public.level(id,adventure) SELECT id,id IN(3,5) FROM generate_series(1,11) id;
         INSERT INTO public.workshop_item SELECT id FROM generate_series(10,80,10) id;
         INSERT INTO public.workshop_item VALUES(-1);
         INSERT INTO public.level_item(id,id_level,workshop_id,deleted,publicly_visible) VALUES
         (1,1,10,false,true),(2,2,20,false,true),(3,2,30,false,true),
         (4,3,40,false,true),(5,4,40,false,true),(6,6,50,true,true),
         (7,7,60,false,true),(8,7,30,false,false),(9,9,70,false,true),
         (10,10,80,false,true),(11,10,80,false,true),(12,11,30,false,true),(13,5,-1,false,true);
         INSERT INTO public.level_points(id_level,points) SELECT id,1000 FROM public.level WHERE id<>4;
         INSERT INTO public.user_point_contribution VALUES(1,1,1,1,1000,1000);
