
        INSERT INTO public.level_item(id,id_level,file_uid,deleted,validation_time_author,
            validation_time_gold,validation_time_silver,validation_time_bronze)
        VALUES(201,1,'ea1',true,1,2,3,4);
        INSERT INTO public.level_item(id,id_level,file_uid,workshop_id) VALUES(202,1,'ea1',123);
        INSERT INTO public.level_item(id,id_level,file_uid,author_id) VALUES(203,1,'ea1',42);
        INSERT INTO public.level_item(id,id_level,file_uid) VALUES(204,1,'unknown'),(205,2,'ea1');
        INSERT INTO public.level_item(id,id_level,file_uid,workshop_id) VALUES(206,1,'ea1',-1);
